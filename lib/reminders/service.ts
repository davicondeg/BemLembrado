import type { SupabaseClient } from "@supabase/supabase-js";
import { parseReminderCommand } from "./parser";
import { enqueueText } from "@/lib/outbox/service";

export async function handleUserMessage(db: SupabaseClient, userId: string, sender: string, text: string) {
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
