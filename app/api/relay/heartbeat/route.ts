import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/server";
import { bearerToken, secretMatches } from "@/lib/security/secrets";

export async function POST(request: Request) {
  if (!secretMatches(bearerToken(request), serverEnv().relaySecret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { workerId?: string; ok?: boolean; error?: string };
  const workerId = body.workerId?.slice(0, 100) || "local-relay";
  const { error } = await createAdminClient().from("worker_heartbeats").upsert({ worker_id: workerId, last_seen_at: new Date().toISOString(), last_cycle_ok: body.ok !== false, last_error: body.error?.slice(0, 1000) || null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
