create table if not exists public.reminder_occurrences (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'confirmed', 'not_done', 'failed', 'cancelled')),
  attempts integer not null default 1 check (attempts between 0 and 100),
  sent_at timestamptz,
  confirmed_at timestamptz,
  finished_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reminder_id, scheduled_for)
);

create index if not exists reminder_occurrences_timeline_idx
  on public.reminder_occurrences (scheduled_for desc, reminder_id);

alter table public.reminder_occurrences enable row level security;

drop policy if exists "occurrences_owner_read" on public.reminder_occurrences;
create policy "occurrences_owner_read" on public.reminder_occurrences for select
using (exists (
  select 1 from public.reminders r
  left join public.assisted_people p on p.id = r.assisted_person_id
  where r.id = reminder_id and (r.user_id = auth.uid() or p.owner_id = auth.uid())
));

create or replace function public.track_reminder_occurrence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  occurrence_status text;
begin
  if old.status = 'scheduled' and new.status = 'queued' then
    insert into public.reminder_occurrences (reminder_id, scheduled_for, status, attempts)
    values (old.id, old.scheduled_for, 'queued', greatest(new.current_attempt, 1))
    on conflict (reminder_id, scheduled_for) do update set
      status = 'queued', attempts = greatest(excluded.attempts, reminder_occurrences.attempts), updated_at = now();
    return new;
  end if;

  if old.status = 'sent' and new.status = 'queued' then
    update public.reminder_occurrences set attempts = greatest(new.current_attempt, attempts), updated_at = now()
    where reminder_id = old.id and scheduled_for = old.scheduled_for;
    return new;
  end if;

  occurrence_status := case
    when new.status = 'failed' then 'failed'
    when new.status = 'cancelled' then 'cancelled'
    when old.status = 'sent' and new.confirmed_at is distinct from old.confirmed_at and new.confirmed_at is not null then 'confirmed'
    when old.status = 'sent' and new.status in ('not_done', 'scheduled') then 'not_done'
    when old.status = 'queued' and new.sent_at is not null then 'sent'
    when new.status = 'confirmed' then 'confirmed'
    when new.status = 'sent' then 'sent'
    else null
  end;

  if occurrence_status is not null then
    insert into public.reminder_occurrences (
      reminder_id, scheduled_for, status, attempts, sent_at, confirmed_at, finished_at, last_error
    ) values (
      old.id, old.scheduled_for, occurrence_status, greatest(old.current_attempt, new.current_attempt, 1),
      new.sent_at, new.confirmed_at,
      case when occurrence_status in ('confirmed', 'not_done', 'failed', 'cancelled') then now() else null end,
      new.last_error
    )
    on conflict (reminder_id, scheduled_for) do update set
      status = excluded.status,
      attempts = greatest(excluded.attempts, reminder_occurrences.attempts),
      sent_at = coalesce(excluded.sent_at, reminder_occurrences.sent_at),
      confirmed_at = coalesce(excluded.confirmed_at, reminder_occurrences.confirmed_at),
      finished_at = coalesce(excluded.finished_at, reminder_occurrences.finished_at),
      last_error = coalesce(excluded.last_error, reminder_occurrences.last_error),
      updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists track_reminder_occurrence on public.reminders;
create trigger track_reminder_occurrence
after update of status, scheduled_for, current_attempt, sent_at, confirmed_at, last_error on public.reminders
for each row execute function public.track_reminder_occurrence();

insert into public.reminder_occurrences (
  reminder_id, scheduled_for, status, attempts, sent_at, confirmed_at, finished_at, last_error
)
select
  r.id,
  case when r.confirmed_at is not null then coalesce(r.sent_at, r.confirmed_at) else r.scheduled_for end,
  case
    when r.confirmed_at is not null then 'confirmed'
    when r.status::text in ('sent', 'failed', 'cancelled', 'not_done') then r.status::text
    else 'sent'
  end,
  greatest(r.current_attempt, 1), r.sent_at, r.confirmed_at,
  case when r.confirmed_at is not null or r.status::text in ('failed', 'cancelled', 'not_done') then r.updated_at else null end,
  r.last_error
from public.reminders r
where r.confirmed_at is not null or r.status::text in ('sent', 'failed', 'cancelled', 'not_done')
on conflict (reminder_id, scheduled_for) do nothing;

comment on table public.reminder_occurrences is
  'Histórico imutável de cada execução de um lembrete, separado da próxima ocorrência agendada.';
