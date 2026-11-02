import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractIncomingMessage } from "@/lib/whatsapp/evolution";
import { handleUserMessage } from "@/lib/reminders/service";
import { serverEnv } from "@/lib/env/server";
import { secretMatches } from "@/lib/security/secrets";
import { hashLinkCode } from "@/lib/whatsapp/link-code";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const receivedSecret = request.headers.get("x-webhook-secret") || url.searchParams.get("secret");
  if (!secretMatches(receivedSecret, serverEnv().webhookSecret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const incoming = extractIncomingMessage(payload);
  if (!incoming || incoming.fromMe || !incoming.messageId) return NextResponse.json({ ignored: true });

  const db = createAdminClient();
  const { data: inserted, error: insertError } = await db.from("inbound_messages").insert({
    provider_message_id: incoming.messageId, instance_name: incoming.instanceName,
    sender: incoming.sender, message_text: incoming.text,
  }).select("id").maybeSingle();
  if (insertError?.code === "23505") return NextResponse.json({ duplicate: true });
  if (insertError || !inserted) return NextResponse.json({ error: "could_not_register_message" }, { status: 500 });

  try {
    const linkCode = incoming.text.toUpperCase().match(/^APP-\d{6}$/)?.[0];
    if (linkCode) {
      const codeHash = hashLinkCode(linkCode, serverEnv().webhookSecret);
      const { data: pendingLink } = await db.from("whatsapp_links").select("id,user_id")
        .eq("code_hash", codeHash).gt("code_expires_at", new Date().toISOString()).is("linked_at", null).maybeSingle();
      if (pendingLink) {
        await db.from("whatsapp_links").update({ phone: incoming.sender, linked_at: new Date().toISOString(), code_hash: null, code_expires_at: null }).eq("id", pendingLink.id);
        await db.from("bot_outbox").insert({ instance_name: incoming.instanceName, recipient: incoming.sender, message_text: "WhatsApp vinculado com sucesso ao Bem Lembrado." });
        await db.from("inbound_messages").update({ processed_at: new Date().toISOString() }).eq("id", inserted.id);
        return NextResponse.json({ linked: true });
      }
    }
    const { data: link, error } = await db.from("whatsapp_links").select("user_id").eq("phone", incoming.sender).not("linked_at", "is", null).maybeSingle();
    if (error) throw error;
    let userId = link?.user_id;
    if (!userId) {
      const { data: assisted, error: assistedError } = await db.from("assisted_people").select("owner_id")
        .eq("whatsapp_e164", incoming.sender).eq("active", true).is("archived_at", null).limit(1).maybeSingle();
      if (assistedError) throw assistedError;
      userId = assisted?.owner_id;
    }
    if (!userId) {
      await db.from("bot_outbox").insert({ instance_name: incoming.instanceName, recipient: incoming.sender, message_text: "Este número ainda não está vinculado a uma conta do Bem Lembrado." });
    } else {
      await handleUserMessage(db, userId, incoming.sender, incoming.text);
    }
    await db.from("inbound_messages").update({ processed_at: new Date().toISOString() }).eq("id", inserted.id);
    return NextResponse.json({ accepted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    await db.from("inbound_messages").update({ processing_error: message.slice(0, 1000) }).eq("id", inserted.id);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
