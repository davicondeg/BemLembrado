alter table public.reminders
  add column if not exists current_attempt integer not null default 0 check (current_attempt between 0 and 5),
  add column if not exists confirmation_deadline timestamptz,
  add column if not exists confirmed_at timestamptz,
  add column if not exists alerted_at timestamptz;

create policy "events_owner_insert" on public.reminder_events for insert
with check (
  exists (
    select 1 from public.reminders r
    where r.id = reminder_id
      and (
        r.user_id = auth.uid()
        or exists (select 1 from public.assisted_people p where p.id = r.assisted_person_id and p.owner_id = auth.uid())
      )
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
    select id, recipient, message, scheduled_for
    from public.reminders
    where status = 'scheduled' and scheduled_for <= now() and recipient is not null
    order by scheduled_for for update skip locked
    limit greatest(1, least(p_limit, 500))
  ), inserted as (
    insert into public.bot_outbox (instance_name, recipient, message_text, reminder_id, occurrence_at)
    select p_instance_name, recipient, message, id, scheduled_for from due
    on conflict (reminder_id, occurrence_at) do nothing
    returning reminder_id
  )
  update public.reminders r
  set status = 'queued', current_attempt = 1, confirmed_at = null,
      alerted_at = null, confirmation_deadline = null, updated_at = now()
  where r.id in (select reminder_id from inserted);
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.dispatch_due_reminders(text, integer) from public, anon, authenticated;
grant execute on function public.dispatch_due_reminders(text, integer) to service_role;
