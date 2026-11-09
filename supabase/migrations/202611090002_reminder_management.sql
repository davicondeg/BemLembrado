alter type public.reminder_status add value if not exists 'paused';

alter table public.reminders
  add column if not exists archived_at timestamptz;

create index if not exists reminders_active_owner_idx
  on public.reminders (user_id, scheduled_for)
  where archived_at is null;

comment on column public.reminders.archived_at is
  'Data em que o lembrete foi retirado das visualizações ativas, preservando seu histórico.';
