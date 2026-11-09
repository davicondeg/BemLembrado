"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { afterConfirmation, afterConfirmationTimeout, afterSuccessfulSend } from "@/lib/reminders/engine";
import { nextOccurrence } from "@/lib/reminders/recurrence";

async function loadReminder(id: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("reminders").select("id,status,scheduled_for,recurrence_rule,confirmation_required,confirmation_timeout_minutes,current_attempt,max_reminder_attempts,repeat_interval_minutes").eq("id", id).maybeSingle();
  if (!data) redirect("/simulador?erro=Lembrete não encontrado.");
  return { supabase, reminder: data };
}

async function event(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], reminderId: string, type: string, payload: object = {}) {
  await supabase.from("reminder_events").insert({ reminder_id: reminderId, event_type: type, payload });
}

function refresh() {
  revalidatePath("/simulador"); revalidatePath("/dashboard"); revalidatePath("/lembretes"); revalidatePath("/historico");
}

export async function simulateSend(formData: FormData) {
  const id = String(formData.get("id") || ""); const { supabase, reminder } = await loadReminder(id);
  const attempt = Math.max(1, reminder.current_attempt || 0);
  const decision = afterSuccessfulSend({ confirmationRequired: reminder.confirmation_required, currentAttempt: attempt, maxAttempts: reminder.max_reminder_attempts, recurring: Boolean(reminder.recurrence_rule) });
  const deadline = decision.action === "wait_confirmation" ? new Date(Date.now() + reminder.confirmation_timeout_minutes * 60_000).toISOString() : null;
  const nextScheduledFor = reminder.recurrence_rule ? nextOccurrence(reminder.scheduled_for, reminder.recurrence_rule) : null;
  const update = decision.action === "reschedule" && nextScheduledFor ? { status: "scheduled", scheduled_for: nextScheduledFor, current_attempt: 0, confirmation_deadline: null } : { status: "sent", sent_at: new Date().toISOString(), current_attempt: attempt, confirmation_deadline: deadline };
  await supabase.from("reminders").update({ ...update, updated_at: new Date().toISOString() }).eq("id", id);
  await event(supabase, id, "simulated_send", { decision: decision.action, attempt }); refresh();
}

export async function simulateTimeout(formData: FormData) {
  const id = String(formData.get("id") || ""); const { supabase, reminder } = await loadReminder(id);
  const decision = afterConfirmationTimeout({ confirmationRequired: reminder.confirmation_required, currentAttempt: reminder.current_attempt, maxAttempts: reminder.max_reminder_attempts, recurring: Boolean(reminder.recurrence_rule) });
  if (decision.action === "retry") await supabase.from("reminders").update({ status: "sent", current_attempt: decision.nextAttempt, confirmation_deadline: new Date(Date.now() + reminder.repeat_interval_minutes * 60_000).toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  else if (decision.action === "reschedule" && reminder.recurrence_rule) await supabase.from("reminders").update({ status: "scheduled", scheduled_for: nextOccurrence(reminder.scheduled_for, reminder.recurrence_rule), current_attempt: 0, confirmation_deadline: null, alerted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  else if (decision.action === "alert") await supabase.from("reminders").update({ status: "not_done", confirmation_deadline: null, alerted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  else await supabase.from("reminders").update({ status: "sent", confirmation_deadline: null, updated_at: new Date().toISOString() }).eq("id", id);
  await event(supabase, id, "simulated_timeout", { decision: decision.action, attempt: reminder.current_attempt }); refresh();
}

export async function simulateConfirmation(formData: FormData) {
  const id = String(formData.get("id") || ""); const { supabase, reminder } = await loadReminder(id);
  const decision = afterConfirmation({ confirmationRequired: reminder.confirmation_required, currentAttempt: reminder.current_attempt, maxAttempts: reminder.max_reminder_attempts, recurring: Boolean(reminder.recurrence_rule) });
  if (decision.action === "reschedule" && reminder.recurrence_rule) await supabase.from("reminders").update({ status: "scheduled", scheduled_for: nextOccurrence(reminder.scheduled_for, reminder.recurrence_rule), current_attempt: 0, confirmation_deadline: null, confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  else await supabase.from("reminders").update({ status: "confirmed", confirmation_deadline: null, confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  await event(supabase, id, "simulated_confirmation", { decision: decision.action }); refresh();
}

export async function resetSimulation(formData: FormData) {
  const id = String(formData.get("id") || ""); const { supabase } = await loadReminder(id);
  await supabase.from("reminders").update({ status: "scheduled", current_attempt: 0, confirmation_deadline: null, confirmed_at: null, alerted_at: null, sent_at: null, last_error: null, updated_at: new Date().toISOString() }).eq("id", id);
  await event(supabase, id, "simulation_reset"); refresh();
}
