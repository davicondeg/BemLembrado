import type { SupabaseClient } from "@supabase/supabase-js";

export async function enqueueText(
  db: SupabaseClient,
  recipient: string,
  message: string,
  instanceName = process.env.EVOLUTION_INSTANCE || "bem-lembrado",
) {
  const { error } = await db.from("bot_outbox").insert({
    instance_name: instanceName,
    recipient,
    message_text: message.slice(0, 2000),
  });
  if (error) throw error;
}
