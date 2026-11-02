alter table public.reminders
  add column if not exists confirmation_required boolean not null default true,
  add column if not exists max_reminder_attempts integer not null default 1 check (max_reminder_attempts between 1 and 5),
  add column if not exists repeat_interval_minutes integer not null default 15 check (repeat_interval_minutes between 5 and 240),
  add column if not exists alert_contact_id uuid references public.authorized_contacts(id) on delete set null;

comment on column public.reminders.confirmation_required is 'Se o lembrete deve aguardar confirmação do destinatário.';
comment on column public.reminders.max_reminder_attempts is 'Quantidade máxima de envios antes do alerta.';
comment on column public.reminders.repeat_interval_minutes is 'Intervalo entre repetições quando não há confirmação.';
comment on column public.reminders.alert_contact_id is 'Contato autorizado que receberá o alerta de não confirmação.';
