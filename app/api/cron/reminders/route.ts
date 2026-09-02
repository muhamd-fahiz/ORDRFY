import { NextResponse, type NextRequest } from "next/server";
import { runReminderEngineOnce } from "@/lib/engine/reminders";
import { recoverStuckWebhookEvents } from "@/lib/engine/webhook-durability";

/**
 * Invoked by pg_net from inside the pg_cron job (20260828120028_reminder_engine_cron.sql),
 * not a public endpoint -- CRON_INTERNAL_SECRET verifies the caller is actually our own
 * scheduled job, not an internet request that happened to guess this path.
 *
 * Also runs webhook-event recovery on the same tick (confirmed gap fix, independent audit)
 * -- reuses this endpoint's existing pg_cron schedule/secret rather than adding a second
 * one for what's the same kind of periodic maintenance sweep the reminder engine's own
 * recover_stuck_reminders() already does internally.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_INTERNAL_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const webhookRecovery = await recoverStuckWebhookEvents();
  const result = await runReminderEngineOnce();
  return NextResponse.json({ ...result, webhookRecovery });
}
