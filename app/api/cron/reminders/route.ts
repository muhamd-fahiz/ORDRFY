import { NextResponse, type NextRequest } from "next/server";
import { runReminderEngineOnce } from "@/lib/engine/reminders";

/**
 * Invoked by pg_net from inside the pg_cron job (20260828120028_reminder_engine_cron.sql),
 * not a public endpoint -- CRON_INTERNAL_SECRET verifies the caller is actually our own
 * scheduled job, not an internet request that happened to guess this path.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_INTERNAL_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runReminderEngineOnce();
  return NextResponse.json(result);
}
