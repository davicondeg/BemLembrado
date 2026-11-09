import type { SupabaseClient } from "@supabase/supabase-js";
import { parseReminderCommand } from "./parser";
import { enqueueText } from "@/lib/outbox/service";
import { nextOccurrence } from "./recurrence";

export async function handleUserMessage(db: SupabaseClient, userId: string, sender: string, text: string) {
  const normalized = text.trim().toLocaleLowerCase("pt-BR");
  if (/^(sim|feito|fiz|ok|confirmo|conclu[ií]do)$/.test(normalized)) {
    const now = new Date().toISOString();
    const { data: reminder, error: reminderError } = await db.from("reminders")
      .select("id,title,scheduled_for,recurrence_rule")
      .eq("user_id", userId)
      .eq("recipient", sender)
      .eq("status", "sent")
      .eq("confirmation_required", true)
      .gt("confirmation_deadline", now)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (reminderError) throw reminderError;
    if (!reminder) return enqueueText(db, sender, "Não encontrei um lembrete aguardando confirmação.");

    const nextScheduledFor = reminder.recurrence_rule ? nextOccurrence(reminder.scheduled_for, reminder.recurrence_rule) : null;
    const { error: updateError } = await db.from("reminders").update(nextScheduledFor ? {
      status: "scheduled", scheduled_for: nextScheduledFor, current_attempt: 0, confirmed_at: now, confirmation_deadline: null, updated_at: now,
    } : {
      status: "confirmed", confirmed_at: now, confirmation_deadline: null, updated_at: now,
    }).eq("id", reminder.id).eq("status", "sent");
    if (updateError) throw updateError;
    const { error: eventError } = await db.from("reminder_events").insert({
      reminder_id: reminder.id, event_type: "confirmed_by_whatsapp", payload: { answer: text.trim() },
    });
    if (eventError) throw eventError;
    return enqueueText(db, sender, `Confirmação registrada para “${reminder.title}”. Obrigado!`);
  }

  const command = parseReminderCommand(text);

  if (command.kind === "ambiguous") return enqueueText(db, sender, command.reason);
  if (command.kind === "unknown") return enqueueText(db, sender, "Não entendi. Você pode pedir, por exemplo: “me lembre de beber água hoje às 20h”.");

  if (command.kind === "create") {
    const { error } = await db.from("reminders").insert({
      user_id: userId, recipient: sender, title: command.message.slice(0, 100), message: command.message,
      kind: "task", scheduled_for: command.scheduledAt, timezone: command.timezone,
      recurrence_rule: command.recurrenceRule, status: "scheduled",
    });
    if (error) throw error;
    return enqueueText(db, sender, command.confirmation);
  }

  if (command.kind === "list") {
    const { data, error } = await db.from("reminders").select("id,message,scheduled_for,recurrence_rule")
      .eq("user_id", userId).eq("recipient", sender).eq("status", "scheduled").order("scheduled_for").limit(10);
    if (error) throw error;
    const response = data?.length
      ? `Seus lembretes:\n${data.map((item, index) => `${index + 1}. ${item.message} — ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(item.scheduled_for))}${item.recurrence_rule ? " (diário)" : ""}`).join("\n")}`
      : "Você não tem lembretes pendentes.";
    return enqueueText(db, sender, response);
  }

  const { data, error } = await db.from("reminders").select("id,message").eq("user_id", userId)
    .eq("recipient", sender).eq("status", "scheduled").ilike("message", `%${command.query}%`).limit(2);
  if (error) throw error;
  if (!data?.length) return enqueueText(db, sender, "Não encontrei um lembrete pendente com essa descrição.");
  if (data.length > 1) return enqueueText(db, sender, "Encontrei mais de um lembrete. Seja mais específico para eu cancelar o correto.");
  const { error: updateError } = await db.from("reminders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", data[0].id);
  if (updateError) throw updateError;
  return enqueueText(db, sender, `Lembrete “${data[0].message}” cancelado.`);
}

export async function handleAuthorizedContactMessage(
  db: SupabaseClient,
  contact: { id: string; fullName: string; assistedName: string },
  sender: string,
  text: string,
) {
  const normalized = text.trim().toLocaleLowerCase("pt-BR");
  const isConfirmation = /^(confirmado|confirmo)$/.test(normalized);
  if (!isConfirmation) {
    return enqueueText(
      db,
      sender,
      `Olá, ${contact.fullName}. Você está cadastrado como contato autorizado de ${contact.assistedName}. Para confirmar manualmente o último alerta, responda CONFIRMADO.`,
    );
  }

  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data: reminder, error: reminderError } = await db.from("reminders")
    .select("id,title")
    .eq("alert_contact_id", contact.id)
    .eq("status", "not_done")
    .gt("alerted_at", since)
    .order("alerted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reminderError) throw reminderError;
  if (!reminder) return enqueueText(db, sender, "Não encontrei um alerta recente aguardando confirmação manual.");

  const now = new Date().toISOString();
  const { error: updateError } = await db.from("reminders").update({
    status: "confirmed", confirmed_at: now, updated_at: now,
  }).eq("id", reminder.id).eq("status", "not_done");
  if (updateError) throw updateError;
  const { error: eventError } = await db.from("reminder_events").insert({
    reminder_id: reminder.id,
    event_type: "confirmed_by_authorized_contact",
    payload: { contact_id: contact.id, answer: text.trim() },
  });
  if (eventError) throw eventError;
  return enqueueText(db, sender, `Confirmação manual registrada para “${reminder.title}”. Obrigado!`);
}
