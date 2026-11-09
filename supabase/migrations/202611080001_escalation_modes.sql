alter table public.reminders
  add column if not exists escalation_mode text not null default 'notify'
  check (escalation_mode in ('record', 'notify', 'priority'));

comment on column public.reminders.escalation_mode is
  'Conduta após a última tentativa sem confirmação: registrar, avisar ou alertar com prioridade.';

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
  alert_was_queued boolean;
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
      alert_was_queued := false;
      contact_phone := null;
      if r.escalation_mode <> 'record' and r.alert_contact_id is not null then
        select whatsapp_e164 into contact_phone from public.authorized_contacts where id = r.alert_contact_id;
      end if;

      if contact_phone is not null and r.alerted_at is null then
        insert into public.bot_outbox (instance_name, recipient, message_text, occurrence_at)
        values (
          p_instance_name,
          contact_phone,
          case when r.escalation_mode = 'priority' then
            format('⚠️ Alerta prioritário do Bem Lembrado: não recebemos resposta ao lembrete “%s” após %s tentativa(s). Entre em contato com a pessoa assistida para verificar se está tudo bem.', r.title, r.current_attempt)
          else
            format('Bem Lembrado: não recebemos resposta ao lembrete “%s” após %s tentativa(s). Recomendamos verificar se está tudo bem.', r.title, r.current_attempt)
          end,
          now()
        );
        alert_was_queued := true;
        insert into public.reminder_events (reminder_id, event_type, payload)
        values (
          r.id,
          case when r.escalation_mode = 'priority' then 'priority_alert_queued' else 'alert_queued' end,
          jsonb_build_object('attempts', r.current_attempt, 'mode', r.escalation_mode)
        );
      else
        insert into public.reminder_events (reminder_id, event_type, payload)
        values (r.id, 'no_response_recorded', jsonb_build_object('attempts', r.current_attempt, 'mode', r.escalation_mode));
      end if;

      if r.recurrence_rule is not null then
        update public.reminders set status = 'scheduled', scheduled_for = scheduled_for + interval '1 day',
          current_attempt = 0, confirmation_deadline = null,
          alerted_at = case when alert_was_queued then now() else alerted_at end, updated_at = now() where id = r.id;
      else
        update public.reminders set status = 'not_done', confirmation_deadline = null,
          alerted_at = case when alert_was_queued then now() else alerted_at end, updated_at = now() where id = r.id;
      end if;
    end if;
    processed := processed + 1;
  end loop;
  return processed;
end;
$$;

revoke all on function public.process_confirmation_timeouts(text, integer) from public, anon, authenticated;
grant execute on function public.process_confirmation_timeouts(text, integer) to service_role;
