import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    supabasePublic: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    backendConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    webhookConfigured: Boolean(process.env.EVOLUTION_WEBHOOK_SECRET),
    relayConfigured: Boolean(process.env.RELAY_SECRET && process.env.JOBS_SECRET),
  });
}
