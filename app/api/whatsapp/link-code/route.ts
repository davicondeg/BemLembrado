import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/server";
import { bearerToken } from "@/lib/security/secrets";
import { generateLinkCode, hashLinkCode } from "@/lib/whatsapp/link-code";

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let env: ReturnType<typeof serverEnv>;
  try { env = serverEnv(); }
  catch { return NextResponse.json({ error: "configuration_incomplete" }, { status: 503 }); }
  const authClient = createClient(env.supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "", {
    global: { headers: { authorization: `Bearer ${token}` } }, auth: { persistSession: false },
  });
  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const code = generateLinkCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const db = createAdminClient();
  const { error: saveError } = await db.from("whatsapp_links").upsert({
    user_id: user.id, phone: null, linked_at: null,
    code_hash: hashLinkCode(code, env.webhookSecret), code_expires_at: expiresAt.toISOString(),
  }, { onConflict: "user_id" });
  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });
  return NextResponse.json({ code, expiresAt: expiresAt.toISOString() });
}
