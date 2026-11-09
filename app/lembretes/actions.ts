"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { buildWeeklyRecurrence, firstOccurrenceOnOrAfter, isWeekdayCode, nextFutureOccurrence } from "@/lib/reminders/recurrence";

function refreshReminderPages() {
  revalidatePath("/lembretes");
  revalidatePath("/dashboard");
  revalidatePath("/historico");
}

export async function createReminder(formData: FormData) {
  const { user, supabase } = await requireUser();
  const personId = String(formData.get("personId") || "");
  const title = String(formData.get("title") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const kind = String(formData.get("kind") || "task");
  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  const repeats = formData.get("repeat") === "on";
  const weekdays = formData.getAll("weekdays").map(String).filter(isWeekdayCode);
  const timeout = Number(formData.get("timeout") || 30);
  const confirmationRequired = formData.get("confirmationRequired") === "on";
  const maxAttempts = Number(formData.get("maxAttempts") || 1);
  const repeatInterval = Number(formData.get("repeatInterval") || 15);
  const escalationMode = String(formData.get("escalationMode") || "notify");
  const requestedContactId = String(formData.get("alertContactId") || "") || null;
  const alertContactId = confirmationRequired && escalationMode !== "record" ? requestedContactId : null;
  if (!personId || title.length < 2 || message.length < 2 || message.length > 500 || !date || !/^\d{2}:\d{2}$/.test(time)) redirect("/lembretes/novo?erro=Revise os campos do lembrete.");
  if (repeats && !weekdays.length) redirect("/lembretes/novo?erro=Escolha pelo menos um dia da semana para repetir.");
  if (!["record", "notify", "priority"].includes(escalationMode)) redirect("/lembretes/novo?erro=Escolha o que fazer se não houver resposta.");
  if (confirmationRequired && escalationMode !== "record" && !alertContactId) redirect("/lembretes/novo?erro=Escolha quem receberá o aviso de ausência de resposta.");
  const { data: person } = await supabase.from("assisted_people").select("id,whatsapp_e164,active").eq("id", personId).single();
  if (!person?.active) redirect("/lembretes/novo?erro=Escolha uma pessoa com perfil ativo.");
  if (alertContactId) {
    const { data: contact } = await supabase.from("authorized_contacts").select("id").eq("id", alertContactId).eq("assisted_person_id", personId).maybeSingle();
    if (!contact) redirect("/lembretes/novo?erro=O contato de alerta não pertence à pessoa selecionada.");
  }
  let scheduled = new Date(`${date}T${time}:00-03:00`);
  if (repeats) {
    const aligned = firstOccurrenceOnOrAfter(scheduled, weekdays);
    if (aligned) scheduled = new Date(aligned);
  }
  if (!Number.isFinite(scheduled.getTime()) || scheduled <= new Date()) redirect("/lembretes/novo?erro=Escolha uma data e horário futuros.");
  const [hour, minute] = time.split(":").map(Number);
  const recurrenceRule = repeats ? buildWeeklyRecurrence(weekdays, hour, minute) : null;
  const { error } = await supabase.from("reminders").insert({ assisted_person_id: person.id, user_id: user.id, recipient: person.whatsapp_e164, kind, title, message, scheduled_for: scheduled.toISOString(), timezone: "America/Sao_Paulo", recurrence_rule: recurrenceRule, confirmation_timeout_minutes: Math.max(5, Math.min(timeout, 1440)), confirmation_required: confirmationRequired, max_reminder_attempts: Math.max(1, Math.min(maxAttempts, 5)), repeat_interval_minutes: Math.max(5, Math.min(repeatInterval, 240)), escalation_mode: confirmationRequired ? escalationMode : "record", alert_contact_id: alertContactId, status: "scheduled" });
  if (error) redirect(`/lembretes/novo?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/lembretes"); revalidatePath("/dashboard");
  redirect("/lembretes?sucesso=Lembrete agendado.");
}

export async function cancelReminder(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") || "");
  const { error } = await supabase.from("reminders").update({ status: "cancelled", confirmation_deadline: null, updated_at: new Date().toISOString() }).eq("id", id).neq("status", "queued");
  refreshReminderPages();
  redirect(error ? `/lembretes?erro=${encodeURIComponent(error.message)}` : "/lembretes?sucesso=Lembrete cancelado.");
}

export async function pauseReminder(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") || "");
  const { error } = await supabase.from("reminders").update({ status: "paused", updated_at: new Date().toISOString() }).eq("id", id).eq("status", "scheduled").not("recurrence_rule", "is", null);
  refreshReminderPages();
  redirect(error ? `/lembretes?erro=${encodeURIComponent(error.message)}` : "/lembretes?sucesso=Recorrência pausada.");
}

export async function resumeReminder(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") || "");
  const { data: reminder } = await supabase.from("reminders").select("recurrence_rule").eq("id", id).eq("status", "paused").maybeSingle();
  if (!reminder?.recurrence_rule) redirect("/lembretes?erro=Não foi possível retomar este lembrete.");
  const scheduledFor = nextFutureOccurrence(reminder.recurrence_rule);
  if (!scheduledFor) redirect("/lembretes?erro=A regra de repetição deste lembrete é inválida.");
  const { error } = await supabase.from("reminders").update({ status: "scheduled", scheduled_for: scheduledFor, current_attempt: 0, confirmation_deadline: null, updated_at: new Date().toISOString() }).eq("id", id).eq("status", "paused");
  refreshReminderPages();
  redirect(error ? `/lembretes?erro=${encodeURIComponent(error.message)}` : "/lembretes?sucesso=Recorrência retomada.");
}

export async function archiveReminder(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") || "");
  const { data: reminder } = await supabase.from("reminders").select("status").eq("id", id).maybeSingle();
  if (!reminder) redirect("/lembretes?erro=Lembrete não encontrado.");
  if (reminder.status === "queued") redirect("/lembretes?erro=Não é possível arquivar enquanto a mensagem está na fila de envio.");
  const update = { archived_at: new Date().toISOString(), status: ["scheduled", "sent", "paused"].includes(reminder.status) ? "cancelled" : reminder.status, confirmation_deadline: null, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("reminders").update(update).eq("id", id);
  refreshReminderPages();
  redirect(error ? `/lembretes?erro=${encodeURIComponent(error.message)}` : "/lembretes?sucesso=Lembrete arquivado.");
}

export async function deleteReminder(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") || "");
  const { data: reminder } = await supabase.from("reminders").select("id,archived_at").eq("id", id).maybeSingle();
  if (!reminder?.archived_at) redirect("/lembretes?erro=Arquive o lembrete antes de excluí-lo permanentemente.");
  const { count } = await supabase.from("bot_outbox").select("id", { count: "exact", head: true }).eq("reminder_id", id).in("status", ["queued", "sending"]);
  if (count) redirect("/lembretes?visualizacao=arquivados&erro=Este lembrete ainda possui uma mensagem na fila.");
  const { error } = await supabase.from("reminders").delete().eq("id", id).not("archived_at", "is", null);
  refreshReminderPages();
  redirect(error ? `/lembretes?arquivados=1&erro=${encodeURIComponent(error.message)}` : "/lembretes?arquivados=1&sucesso=Lembrete excluído permanentemente.");
}

export async function restoreReminder(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") || "");
  const { error } = await supabase.from("reminders").update({ archived_at: null, updated_at: new Date().toISOString() }).eq("id", id).not("archived_at", "is", null);
  refreshReminderPages();
  redirect(error ? `/lembretes?arquivados=1&erro=${encodeURIComponent(error.message)}` : "/lembretes?sucesso=Lembrete restaurado para a lista.");
}
