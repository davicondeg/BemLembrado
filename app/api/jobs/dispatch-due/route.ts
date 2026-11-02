import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/server";
import { bearerToken, secretMatches } from "@/lib/security/secrets";

export async function POST(request: Request) {
  if (!secretMatches(bearerToken(request), serverEnv().jobsSecret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const instance = process.env.EVOLUTION_INSTANCE || "bem-lembrado";
  const db = createAdminClient();
  const [dispatch, confirmations] = await Promise.all([
    db.rpc("dispatch_due_reminders", { p_instance_name: instance, p_limit: 100 }),
    db.rpc("process_confirmation_timeouts", { p_instance_name: instance, p_limit: 100 }),
  ]);
  if (dispatch.error || confirmations.error) return NextResponse.json({ error: dispatch.error?.message || confirmations.error?.message }, { status: 500 });
  return NextResponse.json({ dispatched: dispatch.data, confirmationsProcessed: confirmations.data });
}
