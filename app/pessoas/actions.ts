"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { normalizeBrazilianPhone } from "@/lib/whatsapp/phone";

export async function createAssistedPerson(formData: FormData) {
  const { user, supabase } = await requireUser();
  const fullName = String(formData.get("fullName") || "").trim();
  const phone = normalizeBrazilianPhone(String(formData.get("phone") || ""));
  const contactName = String(formData.get("contactName") || "").trim();
  const contactPhone = normalizeBrazilianPhone(String(formData.get("contactPhone") || ""));
  const consent = formData.get("consent") === "on";
  if (fullName.length < 2 || !phone || contactName.length < 2 || !contactPhone || !consent) redirect("/pessoas/nova?erro=Revise os campos e confirme o consentimento.");

  const { data: person, error } = await supabase.from("assisted_people").insert({ owner_id: user.id, full_name: fullName, whatsapp_e164: phone, active: true }).select("id").single();
  if (error || !person) redirect(`/pessoas/nova?erro=${encodeURIComponent(error?.message || "Falha ao cadastrar.")}`);
  const { error: contactError } = await supabase.from("authorized_contacts").insert({ assisted_person_id: person.id, full_name: contactName, whatsapp_e164: contactPhone, is_primary: true });
  const { error: consentError } = await supabase.from("consents").insert({ assisted_person_id: person.id, consent_type: "mvp_whatsapp_reminders", accepted_by: user.id });
  if (contactError || consentError) {
    await supabase.from("assisted_people").delete().eq("id", person.id);
    redirect("/pessoas/nova?erro=Não foi possível salvar contato e consentimento.");
  }
  revalidatePath("/pessoas"); revalidatePath("/dashboard");
  redirect("/pessoas?sucesso=Pessoa cadastrada.");
}

export async function togglePerson(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") || "");
  const active = formData.get("active") === "true";
  await supabase.from("assisted_people").update({ active: !active }).eq("id", id);
  revalidatePath("/pessoas"); revalidatePath("/dashboard");
}

export async function updateAssistedPerson(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") || "");
  const fullName = String(formData.get("fullName") || "").trim();
  const phone = normalizeBrazilianPhone(String(formData.get("phone") || ""));
  const contactId = String(formData.get("contactId") || "");
  const contactName = String(formData.get("contactName") || "").trim();
  const contactPhone = normalizeBrazilianPhone(String(formData.get("contactPhone") || ""));
  if (!id || fullName.length < 2 || !phone || !contactId || contactName.length < 2 || !contactPhone) redirect(`/pessoas/${id}/editar?erro=Revise os campos informados.`);
  const { error } = await supabase.from("assisted_people").update({ full_name: fullName, whatsapp_e164: phone }).eq("id", id);
  const { error: contactError } = await supabase.from("authorized_contacts").update({ full_name: contactName, whatsapp_e164: contactPhone }).eq("id", contactId).eq("assisted_person_id", id);
  if (error || contactError) redirect(`/pessoas/${id}/editar?erro=${encodeURIComponent(error?.message || contactError?.message || "Falha ao atualizar.")}`);
  await supabase.from("reminders").update({ recipient: phone, updated_at: new Date().toISOString() }).eq("assisted_person_id", id).eq("status", "scheduled");
  revalidatePath(`/pessoas/${id}`); revalidatePath("/pessoas"); revalidatePath("/dashboard");
  redirect(`/pessoas/${id}?sucesso=Cadastro atualizado.`);
}

export async function archivePerson(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") || "");
  const { data: pendingReminders } = await supabase.from("reminders").select("status,confirmation_deadline").eq("assisted_person_id", id).in("status", ["scheduled", "queued", "sent"]);
  const hasPending = pendingReminders?.some((item) => ["scheduled", "queued"].includes(item.status) || (item.status === "sent" && item.confirmation_deadline));
  if (hasPending) redirect(`/pessoas/${id}?erro=Cancele os lembretes pendentes ou conclua as confirmações antes de arquivar.`);
  const { error } = await supabase.from("assisted_people").update({ active: false, archived_at: new Date().toISOString() }).eq("id", id);
  if (error) redirect(`/pessoas/${id}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/pessoas"); revalidatePath("/dashboard");
  redirect("/pessoas?sucesso=Pessoa arquivada.");
}

export async function restorePerson(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") || "");
  const { error } = await supabase.from("assisted_people").update({ active: true, archived_at: null }).eq("id", id);
  if (error) redirect(`/pessoas?status=arquivadas&erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/pessoas"); revalidatePath("/dashboard");
  redirect(`/pessoas/${id}?sucesso=Pessoa restaurada.`);
}

export async function permanentlyDeletePerson(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") || "");
  const typedName = String(formData.get("confirmationName") || "").trim();
  const { data: person } = await supabase.from("assisted_people").select("id,full_name,archived_at").eq("id", id).maybeSingle();
  if (!person) redirect("/pessoas?erro=Pessoa não encontrada.");
  if (!person.archived_at) redirect(`/pessoas/${id}?erro=Arquive a pessoa antes de excluí-la permanentemente.`);
  if (typedName !== person.full_name) redirect(`/pessoas/${id}?erro=O nome digitado não corresponde ao cadastro.`);
  const { data: reminderIds } = await supabase.from("reminders").select("id,status,confirmation_deadline").eq("assisted_person_id", id);
  const pending = reminderIds?.some((item) => ["scheduled", "queued"].includes(item.status) || (item.status === "sent" && item.confirmation_deadline));
  if (pending) redirect(`/pessoas/${id}?erro=Existem lembretes pendentes ou aguardando confirmação.`);
  const ids = reminderIds?.map((item) => item.id) || [];
  if (ids.length) {
    const { count: outboxCount } = await supabase.from("bot_outbox").select("id", { count: "exact", head: true }).in("reminder_id", ids).in("status", ["queued", "sending"]);
    if (outboxCount) redirect(`/pessoas/${id}?erro=Existem mensagens desta pessoa ainda na fila.`);
  }
  const { error } = await supabase.from("assisted_people").delete().eq("id", id);
  if (error) redirect(`/pessoas/${id}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/pessoas"); revalidatePath("/dashboard"); revalidatePath("/historico");
  redirect("/pessoas?status=arquivadas&sucesso=Pessoa excluída permanentemente.");
}
