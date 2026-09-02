// Confirmed gap fix verification (webhook recovery worker): proves that a webhook_events
// row genuinely stuck in 'received' status past the timeout gets reprocessed by the cron
// route's new recovery step, while a fresh (not yet due) 'received' row is left untouched,
// and a stuck row whose account can't be resolved is marked 'failed' rather than left stuck
// forever. Also proves recovery is idempotent -- running it twice doesn't reprocess (and
// therefore doesn't double-insert a message for) an event it already finished.
//
// Uses the REAL cron route (not a direct function import) for the part that matters --
// recovery itself -- matching this project's own "test through the real path" convention
// (see scripts/launch-acceptance-check.mjs, scripts/verify-reminder-send-now-scoping.mjs).
//
// Requires: the dev server running at DEV_SERVER_URL (default http://localhost:3100).
// Usage: node scripts/verify-webhook-recovery.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnvLocal() {
  try {
    const contents = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
    for (const line of contents.split("\n")) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // rely on process.env
  }
}
loadEnvLocal();

const DEV_SERVER_URL = process.env.DEV_SERVER_URL ?? "http://localhost:3100";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const rand = () => Math.random().toString(36).slice(2, 10);
const suffix = rand();

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} -- ${name}${detail ? ` (${detail})` : ""}`);
}

async function callCronRoute() {
  const res = await fetch(`${DEV_SERVER_URL}/api/cron/reminders`, {
    method: "POST",
    headers: { "x-cron-secret": process.env.CRON_INTERNAL_SECRET },
  });
  return { status: res.status, body: await res.json() };
}

async function main() {
  let bizId;
  const providerAccountId = `scoping-test-account-${suffix}`;
  const fromPhoneNumber = `+9198${suffix}`;

  try {
    // --- Seed: one business, connected on WhatsApp with a known provider_account_id -----
    const { data: biz, error: bizError } = await supabase
      .from("businesses")
      .insert({ name: `Webhook Recovery Test ${suffix}`, vertical: "fashion", subscription_status: "active" })
      .select("id")
      .single();
    if (bizError) throw new Error(`Failed to seed business: ${bizError.message}`);
    bizId = biz.id;

    const { data: whatsappChannel } = await supabase.from("channels").select("id").eq("name", "whatsapp").single();

    const { error: connError } = await supabase.from("business_channel_connections").insert({
      business_id: bizId,
      channel_id: whatsappChannel.id,
      provider_account_id: providerAccountId,
      connected: true,
    });
    if (connError) throw new Error(`Failed to seed channel connection: ${connError.message}`);

    // --- Seed 1: genuinely stuck event (old received_at, valid account) -----------------
    const stuckEventId = `stuck-recoverable-${suffix}`;
    const { data: stuckRow, error: stuckError } = await supabase
      .from("webhook_events")
      .insert({
        channel_id: whatsappChannel.id,
        provider: "mock-whatsapp",
        provider_event_id: stuckEventId,
        status: "received",
        received_at: new Date(Date.now() - 15 * 60_000).toISOString(), // 15 min ago
        raw_payload: {
          providerEventId: stuckEventId,
          businessProviderAccountId: providerAccountId,
          fromPhoneNumber,
          text: "Hello, is this available?",
        },
      })
      .select("id")
      .single();
    if (stuckError) throw new Error(`Failed to seed stuck event: ${stuckError.message}`);

    // --- Seed 2: fresh event, NOT yet due for recovery ----------------------------------
    const freshEventId = `fresh-not-due-${suffix}`;
    const { data: freshRow, error: freshError } = await supabase
      .from("webhook_events")
      .insert({
        channel_id: whatsappChannel.id,
        provider: "mock-whatsapp",
        provider_event_id: freshEventId,
        status: "received",
        received_at: new Date().toISOString(),
        raw_payload: {
          providerEventId: freshEventId,
          businessProviderAccountId: providerAccountId,
          fromPhoneNumber,
          text: "This one should not be touched yet",
        },
      })
      .select("id")
      .single();
    if (freshError) throw new Error(`Failed to seed fresh event: ${freshError.message}`);

    // --- Seed 3: stuck event with an account that resolves to no business --------------
    const unresolvableEventId = `stuck-unresolvable-${suffix}`;
    const { data: unresolvableRow, error: unresolvableError } = await supabase
      .from("webhook_events")
      .insert({
        channel_id: whatsappChannel.id,
        provider: "mock-whatsapp",
        provider_event_id: unresolvableEventId,
        status: "received",
        received_at: new Date(Date.now() - 15 * 60_000).toISOString(),
        raw_payload: {
          providerEventId: unresolvableEventId,
          businessProviderAccountId: `no-such-account-${suffix}`,
          fromPhoneNumber,
          text: "Nobody owns this account",
        },
      })
      .select("id")
      .single();
    if (unresolvableError) throw new Error(`Failed to seed unresolvable event: ${unresolvableError.message}`);

    // --- Act: run the cron route once (recovery + reminder tick) -----------------------
    const first = await callCronRoute();
    record("cron route call succeeded", first.status === 200, JSON.stringify(first.body?.webhookRecovery));

    // --- Assert: the stuck, resolvable event was reprocessed and produced a message ----
    const { data: stuckAfter } = await supabase.from("webhook_events").select("status").eq("id", stuckRow.id).single();
    record(
      "genuinely stuck event was recovered and marked processed",
      stuckAfter.status === "processed",
      `status=${stuckAfter.status}`,
    );

    // The mock provider/normalizer generates its own providerMessageId (a fresh mock-wa-
    // <uuid>), not the webhook's own providerEventId -- so identify the inbound message by
    // content/business instead of by id.
    const { data: inboundMessages } = await supabase
      .from("messages")
      .select("id, content, direction")
      .eq("business_id", bizId)
      .eq("direction", "inbound");
    record(
      "recovered event produced exactly one inbound message",
      inboundMessages?.length === 1 && inboundMessages[0].content === "Hello, is this available?",
      `count=${inboundMessages?.length}`,
    );

    // --- Assert: the fresh, not-yet-due event was left completely untouched ------------
    const { data: freshAfter } = await supabase.from("webhook_events").select("status").eq("id", freshRow.id).single();
    record(
      "fresh (not yet due) event was left untouched",
      freshAfter.status === "received",
      `status=${freshAfter.status}`,
    );

    // --- Assert: the unresolvable stuck event was marked failed, not left stuck --------
    const { data: unresolvableAfter } = await supabase
      .from("webhook_events")
      .select("status")
      .eq("id", unresolvableRow.id)
      .single();
    record(
      "stuck event with no resolvable business was marked failed, not left stuck",
      unresolvableAfter.status === "failed",
      `status=${unresolvableAfter.status}`,
    );

    // --- Act again: idempotency -- a second recovery pass must not reprocess ----------
    const second = await callCronRoute();
    record("second cron route call succeeded", second.status === 200);

    const { data: inboundMessagesAfterSecondRun } = await supabase
      .from("messages")
      .select("id")
      .eq("business_id", bizId)
      .eq("direction", "inbound");
    record(
      "recovery is idempotent: a second pass does not create a duplicate message",
      inboundMessagesAfterSecondRun?.length === 1,
      `count=${inboundMessagesAfterSecondRun?.length}`,
    );
  } finally {
    if (bizId) await supabase.from("businesses").delete().eq("id", bizId);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    console.log("FAILED:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Script error:", error);
  process.exit(1);
});
