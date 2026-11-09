create or replace function public.next_reminder_occurrence(p_current timestamptz, p_rule text)
returns timestamptz
language plpgsql
immutable
set search_path = public
as $$
declare
  candidate timestamptz;
  day_code text;
  selected_days text;
  offset_days integer;
begin
  if p_rule is null then
    return null;
  end if;

  if p_rule like '%FREQ=DAILY%' then
    return p_current + interval '1 day';
  end if;

  selected_days := substring(p_rule from 'BYDAY=([^;]+)');
  if selected_days is null then
    return null;
  end if;

  for offset_days in 1..7 loop
    candidate := p_current + make_interval(days => offset_days);
    day_code := (array['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'])[
      extract(dow from candidate at time zone 'America/Sao_Paulo')::integer + 1
    ];
    if day_code = any(string_to_array(selected_days, ',')) then
      return candidate;
    end if;
  end loop;

  return null;
end;
$$;

comment on function public.next_reminder_occurrence(timestamptz, text) is
  'Calcula a próxima ocorrência de uma regra diária ou semanal com BYDAY.';

create or replace function public.align_weekday_recurrence_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  aligned_at timestamptz;
begin
  if old.recurrence_rule like '%FREQ=WEEKLY%'
    and new.scheduled_for = old.scheduled_for + interval '1 day' then
    aligned_at := public.next_reminder_occurrence(old.scheduled_for, old.recurrence_rule);
    if aligned_at is not null then
      new.scheduled_for := aligned_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists align_weekday_recurrence_update on public.reminders;
create trigger align_weekday_recurrence_update
before update of scheduled_for on public.reminders
for each row execute function public.align_weekday_recurrence_update();

revoke all on function public.next_reminder_occurrence(timestamptz, text) from public, anon, authenticated;
grant execute on function public.next_reminder_occurrence(timestamptz, text) to service_role;
