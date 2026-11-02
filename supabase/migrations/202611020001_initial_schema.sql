create type public.reminder_status as enum ('scheduled', 'queued', 'sent', 'confirmed', 'postponed', 'not_done', 'failed', 'expired', 'cancelled');
create type public.reminder_kind as enum ('medication', 'appointment', 'task');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now()
);

create table public.assisted_people (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  whatsapp_e164 text not null,
  timezone text not null default 'America/Sao_Paulo',
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (owner_id, whatsapp_e164)
);

create table public.authorized_contacts (
  id uuid primary key default gen_random_uuid(),
  assisted_person_id uuid not null references public.assisted_people(id) on delete cascade,
  full_name text not null,
  whatsapp_e164 text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  assisted_person_id uuid not null references public.assisted_people(id) on delete cascade,
  consent_type text not null,
  accepted_by uuid not null references public.profiles(id),
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  assisted_person_id uuid not null references public.assisted_people(id) on delete cascade,
  kind public.reminder_kind not null,
  title text not null,
  message text not null,
  scheduled_for timestamptz not null,
  recurrence_rule text,
  confirmation_timeout_minutes integer not null default 30 check (confirmation_timeout_minutes between 5 and 1440),
  status public.reminder_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reminder_events (
  id bigint generated always as identity primary key,
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  provider_message_id text,
  payload jsonb not null default '{}'::jsonb,
  error_message text
);

create index reminders_due_idx on public.reminders (scheduled_for) where status = 'scheduled';
create index reminder_events_reminder_idx on public.reminder_events (reminder_id, occurred_at desc);

alter table public.profiles enable row level security;
alter table public.assisted_people enable row level security;
alter table public.authorized_contacts enable row level security;
alter table public.consents enable row level security;
alter table public.reminders enable row level security;
alter table public.reminder_events enable row level security;

create policy "profiles_read_own" on public.profiles for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid());
create policy "assisted_people_owner_all" on public.assisted_people for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "contacts_owner_all" on public.authorized_contacts for all using (exists (select 1 from public.assisted_people p where p.id = assisted_person_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.assisted_people p where p.id = assisted_person_id and p.owner_id = auth.uid()));
create policy "consents_owner_all" on public.consents for all using (exists (select 1 from public.assisted_people p where p.id = assisted_person_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.assisted_people p where p.id = assisted_person_id and p.owner_id = auth.uid()));
create policy "reminders_owner_all" on public.reminders for all using (exists (select 1 from public.assisted_people p where p.id = assisted_person_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.assisted_people p where p.id = assisted_person_id and p.owner_id = auth.uid()));
create policy "events_owner_read" on public.reminder_events for select using (exists (select 1 from public.reminders r join public.assisted_people p on p.id = r.assisted_person_id where r.id = reminder_id and p.owner_id = auth.uid()));
