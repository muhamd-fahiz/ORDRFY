// Audit finding #2 verification (docs/architecture/decisions/0037-webhook-recovery-and-audit-fixes.md):
// proves that a webhook_events row left in status='failed' -- simulating a real crash AFTER
// the inbound message was durably stored but BEFORE automation processing completed (an
// audit-write failure, any later exception) -- is actually RESUMED by the recovery job, not
// silently no-op'd. Before this fix, processInboundMessage() treated the resulting
// (provider, provider_message_id) duplicate as unconditional proof "already fully processed"
// and returned immediately; combined with claim_stuck_webhook_event() never having reclaimed
// 'failed' rows at all, this made any post-storage failure permanently unrecoverable.
//
// Simulates the crash directly at the database level (insert the message with
// automation_processed_at left NULL, insert a matching webhook_events row already at
// status='failed') rather than trying to trigger a real mid-pipeline exception through the
// live HTTP path, which the codebase has no fault-injection hook for. This exercises the
// exact state a real crash leaves behind and drives recovery through the REAL cron route,
// matching this project's "test through the real path" convention (ADR-0023) for the part
// that actually matters here -- recovery itself.
//
// Requires: the dev server running at DEV_SERVER_URL (default http://localhost:3100).
// Usage: node scripts/verify-webhook-recovery-resumption.mjs

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

let bizId;

async function main() {
  const providerAccountId = `resume-test-account-${suffix}`;
  const phone = `+91700${suffix}9`;
  const uniqueKeyword = `xresume${suffix}`;
  const providerMessageId = `resume-test-msg-${suffix}`;

  try {
    // --- Seed: business, rules_only (default), one keyword rule, WhatsApp connection -----
    const { data: biz, error: bizError } = await supabase
      .from("businesses")
      .insert({ name: `Resumption Test Biz ${suffix}`, vertical: "fashion", subscription_status: "active" })
      .select("id")
      .single();
    if (bizError) throw new Error(`Failed to seed business: ${bizError.message}`);
    bizId = biz.id;

    const { data: waChannel } = await supabase.from("channels").select("id").eq("name", "whatsapp").single();

    const { error: connError } = await supabase.from("business_channel_connections").insert({
      business_id: bizId,
      channel_id: waChannel.id,
      provider_account_id: providerAccountId,
      connected: true,
    });
    if (connError) throw new Error(`Failed to seed channel connection: ${connError.message}`);

    const { error: ruleError } = await supabase.from("internal_reply_rules").insert({
      business_id: bizId,
      vertical: "fashion",
      rule_key: "resume_test_rule",
      trigger_keywords: [uniqueKeyword],
      reply_text: "Resumed reply: here is the info you asked for.",
    });
    if (ruleError) throw new Error(`Failed to seed rule: ${ruleError.message}`);

    // --- Simulate the crash: contact + identity + message ALREADY stored, but
    // automation_processed_at left NULL, exactly like a real crash after storage but before
    // the pipeline finished. -------------------------------------------------------------
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .insert({ business_id: bizId, name: "Resume Test Contact" })
      .select("id")
      .single();
    if (contactError) throw new Error(`Failed to seed contact: ${contactError.message}`);

    const { error: identityError } = await supabase.from("contact_channel_identities").insert({
      contact_id: contact.id,
      business_id: bizId,
      channel_id: waChannel.id,
      provider_user_id: phone,
      last_inbound_at: new Date().toISOString(),
    });
    if (identityError) throw new Error(`Failed to seed contact identity: ${identityError.message}`);

    const messageText = `what about ${uniqueKeyword}?`;
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        contact_id: contact.id,
        business_id: bizId,
        channel_id: waChannel.id,
        direction: "inbound",
        message_type: "text",
        content: messageText,
        provider: "mock-whatsapp",
        provider_message_id: providerMessageId,
        // automation_processed_at intentionally omitted -> NULL, simulating an interrupted attempt.
      })
      .select("id")
      .single();
    if (messageError) throw new Error(`Failed to seed the pre-crash message: ${messageError.message}`);

    const rawPayload = {
      businessProviderAccountId: providerAccountId,
      fromPhoneNumber: phone,
      text: messageText,
      providerMessageId,
    };
    const { data: webhookEvent, error: webhookError } = await supabase
      .from("webhook_events")
      .insert({
        channel_id: waChannel.id,
        provider: "mock-whatsapp",
        provider_event_id: `resume-test-event-${suffix}`,
        business_id: bizId,
        raw_payload: rawPayload,
        status: "failed",
        attempt_count: 0,
      })
      .select("id")
      .single();
    if (webhookError) throw new Error(`Failed to seed the pre-crash webhook event: ${webhookError.message}`);

    // --- Trigger recovery via the REAL cron route ---------------------------------------
    const { status, body } = await callCronRoute();
    record("cron route responds 200", status === 200, JSON.stringify(body?.webhookRecovery));

    // --- Assert: resumed, not re-inserted; completed, not re-failed; replied exactly once ---
    const { data: messageAfter } = await supabase
      .from("messages")
      .select("automation_processed_at")
      .eq("id", message.id)
      .single();
    const { count: totalWithThisProviderMessageId } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("provider", "mock-whatsapp")
      .eq("provider_message_id", providerMessageId);
    const { data: webhookAfter } = await supabase
      .from("webhook_events")
      .select("status, attempt_count")
      .eq("id", webhookEvent.id)
      .single();
    const { count: outboundCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", contact.id)
      .eq("direction", "outbound");

    record(
      "resumed processing completed: automation_processed_at set, no duplicate message row, webhook marked processed, exactly one reply sent",
      messageAfter?.automation_processed_at !== null &&
        totalWithThisProviderMessageId === 1 &&
        webhookAfter?.status === "processed" &&
        outboundCount === 1,
      JSON.stringify({ messageAfter, totalWithThisProviderMessageId, webhookAfter, outboundCount }),
    );

    // --- A second recovery run must not resend or reprocess (now genuinely finished) ----
    await callCronRoute();
    const { count: outboundCountAfterSecondRun } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", contact.id)
      .eq("direction", "outbound");
    record(
      "a second recovery run does not resend once the message is genuinely marked processed",
      outboundCountAfterSecondRun === 1,
      `outboundCount=${outboundCountAfterSecondRun}`,
    );

    // --- Retry cap: a failed event already at max_attempts is never reclaimed ----------
    const { data: cappedEvent, error: cappedError } = await supabase
      .from("webhook_events")
      .insert({
        channel_id: waChannel.id,
        provider: "mock-whatsapp",
        provider_event_id: `resume-test-capped-${suffix}`,
        business_id: bizId,
        raw_payload: { businessProviderAccountId: "does-not-exist", fromPhoneNumber: phone, text: "irrelevant" },
        status: "failed",
        attempt_count: 5,
      })
      .select("id")
      .single();
    if (cappedError) throw new Error(`Failed to seed the capped webhook event: ${cappedError.message}`);

    await callCronRoute();
    const { data: cappedAfter } = await supabase
      .from("webhook_events")
      .select("status, attempt_count")
      .eq("id", cappedEvent.id)
      .single();
    record(
      "a failed webhook event already at the attempt cap is left alone, not retried forever",
      cappedAfter?.status === "failed" && cappedAfter?.attempt_count === 5,
      JSON.stringify(cappedAfter),
    );

    const failed = results.filter((r) => !r.pass);
    console.log(`\n${results.length - failed.length}/${results.length} passed.`);
    if (failed.length > 0) process.exitCode = 1;
  } finally {
    if (bizId) {
      const { error: webhookCleanupError } = await supabase.from("webhook_events").delete().eq("business_id", bizId);
      if (webhookCleanupError) console.error(`webhook_events cleanup failed for business ${bizId}: ${webhookCleanupError.message}`);
      const { error } = await supabase.from("businesses").delete().eq("id", bizId);
      if (error) console.error(`Cleanup failed for business ${bizId}: ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
