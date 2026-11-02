create table public.worker_heartbeats (
  worker_id text primary key,
  last_seen_at timestamptz not null default now(),
  last_cycle_ok boolean not null default true,
  last_error text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.worker_heartbeats enable row level security;
create policy "authenticated_read_worker_status" on public.worker_heartbeats for select to authenticated using (true);

create or replace function public.dispatch_due_reminders(p_instance_name text, p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare inserted_count integer;
begin
  with due as (
    select id, recipient, message, scheduled_for, confirmation_required
    from public.reminders
    where status = 'scheduled' and scheduled_for <= now() and recipient is not null
    order by scheduled_for for update skip locked
    limit greatest(1, least(p_limit, 500))
  ), inserted as (
    insert into public.bot_outbox (instance_name, recipient, message_text, reminder_id, occurrence_at)
    select p_instance_name, recipient,
      case when confirmation_required then message || E'\n\nResponda “sim” para confirmar.' else message end,
      id, scheduled_for from due
    on conflict (reminder_id, occurrence_at) do nothing
    returning reminder_id
  )
  update public.reminders r set status = 'queued', current_attempt = 1,
    confirmed_at = null, alerted_at = null, confirmation_deadline = null, updated_at = now()
  where r.id in (select reminder_id from inserted);
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.process_confirmation_timeouts(p_instance_name text, p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  processed integer := 0;
  contact_phone text;
begin
  for r in
    select * from public.reminders
    where status = 'sent' and confirmation_required = true
      and confirmation_deadline is not null and confirmation_deadline <= now()
    order by confirmation_deadline for update skip locked
    limit greatest(1, least(p_limit, 500))
  loop
    if r.current_attempt < r.max_reminder_attempts then
      insert into public.bot_outbox (instance_name, recipient, message_text, reminder_id, occurrence_at)
      values (p_instance_name, r.recipient,
        format('Lembrete (%s/%s): %s', r.current_attempt + 1, r.max_reminder_attempts, r.message),
        r.id, now())
      on conflict do nothing;
      update public.reminders set status = 'queued', current_attempt = current_attempt + 1,
        confirmation_deadline = null, updated_at = now() where id = r.id;
      insert into public.reminder_events (reminder_id, event_type, payload)
      values (r.id, 'retry_queued', jsonb_build_object('attempt', r.current_attempt + 1));
    else
      select whatsapp_e164 into contact_phone from public.authorized_contacts where id = r.alert_contact_id;
      if contact_phone is not null and r.alerted_at is null then
        insert into public.bot_outbox (instance_name, recipient, message_text, occurrence_at)
        values (p_instance_name, contact_phone,
          format('Bem Lembrado: não recebemos confirmação do lembrete "%s" após %s tentativa(s).', r.title, r.current_attempt), now());
        insert into public.reminder_events (reminder_id, event_type, payload)
        values (r.id, 'alert_queued', jsonb_build_object('attempts', r.current_attempt));
      end if;
      if r.recurrence_rule is not null then
        update public.reminders set status = 'scheduled', scheduled_for = scheduled_for + interval '1 day',
          current_attempt = 0, confirmation_deadline = null, alerted_at = now(), updated_at = now() where id = r.id;
      else
        update public.reminders set status = 'not_done', confirmation_deadline = null,
          alerted_at = now(), updated_at = now() where id = r.id;
      end if;
    end if;
    processed := processed + 1;
  end loop;
  return processed;
end;
$$;

revoke all on function public.process_confirmation_timeouts(text, integer) from public, anon, authenticated;
grant execute on function public.process_confirmation_timeouts(text, integer) to service_role;
