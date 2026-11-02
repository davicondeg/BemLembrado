import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/server";
import { bearerToken, secretMatches } from "@/lib/security/secrets";

export async function GET(request: Request) {
  if (!secretMatches(bearerToken(request), serverEnv().relaySecret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const workerId = request.headers.get("x-worker-id")?.slice(0, 100) || "local-relay";
  const { data, error } = await createAdminClient().rpc("claim_outbox_message", { p_worker_id: workerId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data?.[0] || null });
}
