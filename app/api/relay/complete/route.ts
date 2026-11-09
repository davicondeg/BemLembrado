import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/server";
import { bearerToken, secretMatches } from "@/lib/security/secrets";
import { afterSuccessfulSend } from "@/lib/reminders/engine";
import { nextOccurrence } from "@/lib/reminders/recurrence";

export async function POST(request: Request) {
  if (!secretMatches(bearerToken(request), serverEnv().relaySecret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: number; success?: boolean; error?: string; providerMessageId?: string } | null;
  if (!body?.id || typeof body.success !== "boolean") return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const db = createAdminClient();
  const { data: item, error: readError } = await db.from("bot_outbox").select("attempts,max_attempts,reminder_id,occurrence_at").eq("id", body.id).eq("status", "sending").single();
  if (readError || !item) return NextResponse.json({ error: "item_not_found" }, { status: 404 });

  const now = new Date();
  const terminalFailure = !body.success && item.attempts >= item.max_attempts;
  const status = body.success ? "sent" : terminalFailure ? "failed" : "queued";
  const retryAt = new Date(now.getTime() + Math.min(300, 2 ** item.attempts * 5) * 1000);
  const { error } = await db.from("bot_outbox").update({
    status, sent_at: body.success ? now.toISOString() : null,
    provider_message_id: body.providerMessageId?.slice(0, 200) || null,
    last_error: body.success ? null : (body.error || "send_failed").slice(0, 1000),
    available_at: body.success || terminalFailure ? now.toISOString() : retryAt.toISOString(),
    locked_at: null, locked_by: null, updated_at: now.toISOString(),
  }).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (item.reminder_id) {
    const { data: reminder } = await db.from("reminders").select("recurrence_rule,scheduled_for,confirmation_required,confirmation_timeout_minutes,current_attempt,max_reminder_attempts").eq("id", item.reminder_id).single();
    if (body.success && reminder) {
      const decision = afterSuccessfulSend({ confirmationRequired: reminder.confirmation_required, currentAttempt: reminder.current_attempt, maxAttempts: reminder.max_reminder_attempts, recurring: Boolean(reminder.recurrence_rule) });
      if (decision.action === "reschedule") {
        const nextScheduledFor = nextOccurrence(reminder.scheduled_for, reminder.recurrence_rule);
        if (nextScheduledFor) await db.from("reminders").update({ status: "scheduled", scheduled_for: nextScheduledFor, current_attempt: 0, sent_at: now.toISOString(), last_error: null, updated_at: now.toISOString() }).eq("id", item.reminder_id);
      } else {
        const deadline = decision.action === "wait_confirmation" ? new Date(now.getTime() + reminder.confirmation_timeout_minutes * 60_000).toISOString() : null;
        await db.from("reminders").update({ status: "sent", sent_at: now.toISOString(), confirmation_deadline: deadline, last_error: null, updated_at: now.toISOString() }).eq("id", item.reminder_id);
      }
    } else {
      await db.from("reminders").update(body.success
        ? { status: "sent", sent_at: now.toISOString(), last_error: null, updated_at: now.toISOString() }
        : terminalFailure ? { status: "failed", last_error: body.error || "send_failed", updated_at: now.toISOString() } : { last_error: body.error || "send_failed", updated_at: now.toISOString() })
        .eq("id", item.reminder_id);
    }
  }
  return NextResponse.json({ updated: true, status });
}
