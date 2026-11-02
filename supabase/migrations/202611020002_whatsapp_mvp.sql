create type public.outbox_status as enum ('queued', 'sending', 'sent', 'failed');

alter type public.reminder_status add value if not exists 'queued';
alter type public.reminder_status add value if not exists 'cancelled';

alter table public.reminders
  alter column assisted_person_id drop not null,
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists recipient text,
  add column if not exists timezone text not null default 'America/Sao_Paulo',
  add column if not exists sent_at timestamptz,
  add column if not exists last_error text;

alter table public.reminders
  add constraint reminders_owner_source_check check (assisted_person_id is not null or user_id is not null);

update public.reminders r
set user_id = p.owner_id, recipient = p.whatsapp_e164
from public.assisted_people p
where r.assisted_person_id = p.id and (r.user_id is null or r.recipient is null);

create table public.whatsapp_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  phone text unique,
  code_hash text,
  code_expires_at timestamptz,
  linked_at timestamptz,
  created_at timestamptz not null default now(),
  check (phone is null or phone ~ '^[0-9]{10,15}$')
);

create unique index whatsapp_links_user_idx on public.whatsapp_links (user_id);
create unique index whatsapp_links_code_idx on public.whatsapp_links (code_hash) where code_hash is not null;

create table public.inbound_messages (
  id bigint generated always as identity primary key,
  provider text not null default 'evolution',
  provider_message_id text not null,
  instance_name text not null,
  sender text not null,
  message_text text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  unique (provider, provider_message_id)
);

create table public.bot_outbox (
  id bigint generated always as identity primary key,
  provider text not null default 'evolution',
  instance_name text not null,
  recipient text not null check (recipient ~ '^[0-9]{10,15}$'),
  message_text text not null check (char_length(message_text) between 1 and 2000),
  status public.outbox_status not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  reminder_id uuid references public.reminders(id) on delete set null,
  occurrence_at timestamptz,
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (reminder_id, occurrence_at)
);

create index bot_outbox_claim_idx on public.bot_outbox (available_at, id) where status = 'queued';
create index reminders_dispatch_idx on public.reminders (scheduled_for, id) where status = 'scheduled';

alter table public.whatsapp_links enable row level security;
alter table public.inbound_messages enable row level security;
alter table public.bot_outbox enable row level security;

create policy "links_owner_read" on public.whatsapp_links for select using (user_id = auth.uid());
create policy "outbox_owner_read" on public.bot_outbox for select using (
  reminder_id is not null and exists (
    select 1 from public.reminders r where r.id = reminder_id and r.user_id = auth.uid()
  )
);

drop policy if exists "reminders_owner_all" on public.reminders;
create policy "reminders_owner_all" on public.reminders for all
using (
  user_id = auth.uid() or exists (
    select 1 from public.assisted_people p where p.id = assisted_person_id and p.owner_id = auth.uid()
  )
)
with check (
  user_id = auth.uid() or exists (
    select 1 from public.assisted_people p where p.id = assisted_person_id and p.owner_id = auth.uid()
  )
);

create or replace function public.dispatch_due_reminders(p_instance_name text, p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare inserted_count integer;
begin
  with due as (
    select id, recipient, message
    from public.reminders
    where status = 'scheduled'
      and scheduled_for <= now()
      and recipient is not null
    order by scheduled_for
    for update skip locked
    limit greatest(1, least(p_limit, 500))
  ), inserted as (
    insert into public.bot_outbox (instance_name, recipient, message_text, reminder_id, occurrence_at)
    select p_instance_name, recipient, message, id, scheduled_for from due
    on conflict (reminder_id, occurrence_at) do nothing
    returning reminder_id
  )
  update public.reminders r set status = 'queued', updated_at = now()
  where r.id in (select reminder_id from inserted);

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.claim_outbox_message(p_worker_id text)
returns setof public.bot_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.bot_outbox o
  set status = 'sending', locked_at = now(), locked_by = p_worker_id,
      attempts = attempts + 1, updated_at = now()
  where o.id = (
    select id from public.bot_outbox
    where (status = 'queued' and available_at <= now())
       or (status = 'sending' and locked_at < now() - interval '5 minutes')
    order by available_at, id
    for update skip locked
    limit 1
  )
  returning o.*;
end;
$$;

revoke all on function public.dispatch_due_reminders(text, integer) from public, anon, authenticated;
revoke all on function public.claim_outbox_message(text) from public, anon, authenticated;
grant execute on function public.dispatch_due_reminders(text, integer) to service_role;
grant execute on function public.claim_outbox_message(text) to service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, 'Usuário'), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
