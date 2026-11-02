"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";

export async function createReminder(formData: FormData) {
  const { user, supabase } = await requireUser();
  const personId = String(formData.get("personId") || "");
  const title = String(formData.get("title") || "").trim();
  const message = String(formData.get("message") || "").trim();
  const kind = String(formData.get("kind") || "task");
  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  const daily = formData.get("daily") === "on";
  const timeout = Number(formData.get("timeout") || 30);
  const confirmationRequired = formData.get("confirmationRequired") === "on";
  const maxAttempts = Number(formData.get("maxAttempts") || 1);
  const repeatInterval = Number(formData.get("repeatInterval") || 15);
  const alertContactId = String(formData.get("alertContactId") || "") || null;
  if (!personId || title.length < 2 || message.length < 2 || message.length > 500 || !date || !/^\d{2}:\d{2}$/.test(time)) redirect("/lembretes/novo?erro=Revise os campos do lembrete.");
  const { data: person } = await supabase.from("assisted_people").select("id,whatsapp_e164,active").eq("id", personId).single();
  if (!person?.active) redirect("/lembretes/novo?erro=Escolha uma pessoa com perfil ativo.");
  if (alertContactId) {
    const { data: contact } = await supabase.from("authorized_contacts").select("id").eq("id", alertContactId).eq("assisted_person_id", personId).maybeSingle();
    if (!contact) redirect("/lembretes/novo?erro=O contato de alerta não pertence à pessoa selecionada.");
  }
  const scheduled = new Date(`${date}T${time}:00-03:00`);
  if (!Number.isFinite(scheduled.getTime()) || scheduled <= new Date()) redirect("/lembretes/novo?erro=Escolha uma data e horário futuros.");
  const [hour, minute] = time.split(":").map(Number);
  const { error } = await supabase.from("reminders").insert({ assisted_person_id: person.id, user_id: user.id, recipient: person.whatsapp_e164, kind, title, message, scheduled_for: scheduled.toISOString(), timezone: "America/Sao_Paulo", recurrence_rule: daily ? `FREQ=DAILY;BYHOUR=${hour};BYMINUTE=${minute}` : null, confirmation_timeout_minutes: Math.max(5, Math.min(timeout, 1440)), confirmation_required: confirmationRequired, max_reminder_attempts: Math.max(1, Math.min(maxAttempts, 5)), repeat_interval_minutes: Math.max(5, Math.min(repeatInterval, 240)), alert_contact_id: confirmationRequired ? alertContactId : null, status: "scheduled" });
  if (error) redirect(`/lembretes/novo?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/lembretes"); revalidatePath("/dashboard");
  redirect("/lembretes?sucesso=Lembrete agendado.");
}

export async function cancelReminder(formData: FormData) {
  const { supabase } = await requireUser();
  await supabase.from("reminders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", String(formData.get("id") || "")).eq("status", "scheduled");
  revalidatePath("/lembretes"); revalidatePath("/dashboard");
}
