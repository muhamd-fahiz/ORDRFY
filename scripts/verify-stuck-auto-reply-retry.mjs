// Pre-Phase 7 correctness remediation, Finding 2 verification: proves that a genuine
// provider send failure no longer permanently suppresses an auto-reply.
//
// Before this fix, sendAutoReply() (lib/engine/automation.ts) treated the mere EXISTENCE of
// a messages row at its idempotency key as proof "already attempted" regardless of
// send_status -- so a row left at 'pending_send' after a provider throw was never retried,
// even though webhook recovery would faithfully reprocess the inbound message forever. This
// script drives that exact failure through the REAL processInboundMessage() pipeline (not a
// hand-simulated DB state) using simulateSendFailuresFor() (lib/channels/whatsapp/mock.ts),
// a test-only hook added specifically because the mock provider could never otherwise throw
// under any real code path -- this bug was structurally unverifiable before that hook existed.
//
// Runs entirely in one process via tsx (no dev server needed) -- calls processInboundMessage()
// directly, exactly the same function the real webhook route and webhook recovery both call.
//
// Usage: npx tsx scripts/verify-stuck-auto-reply-retry.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { processInboundMessage } from "../lib/engine/automation";
import { simulateSendFailuresFor } from "../lib/channels/whatsapp/mock";

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

/** Mirrors the exact "confirmed-sent replies only" filter lib/data/today.ts and
 *  lib/data/contacts-list.ts now apply, so this script proves the SAME query shape the real
 *  UI uses, not a looser approximation of it. */
async function replyVisibleToOwner(businessId, contactId, inboundMessageId) {
  const { data } = await supabase
    .from("messages")
    .select("content, outbound_idempotency_key")
    .eq("business_id", businessId)
    .eq("contact_id", contactId)
    .eq("direction", "outbound")
    .eq("is_auto_reply", true)
    .eq("send_status", "sent");
  return (data ?? []).find((r) => r.outbound_idempotency_key?.startsWith(`${inboundMessageId}:`))?.content ?? null;
}

let bizId;

async function main() {
  const phone = `+91stuck${suffix}`;
  const providerMessageId = `stuck-retry-test-msg-${suffix}`;

  try {
    const { data: biz, error: bizError } = await supabase
      .from("businesses")
      .insert({ name: `Stuck Auto-Reply Test Biz ${suffix}`, vertical: "fashion", subscription_status: "active" })
      .select("id")
      .single();
    if (bizError) throw new Error(`Failed to seed business: ${bizError.message}`);
    bizId = biz.id;

    const normalized = {
      channel: "whatsapp",
      providerUserId: phone,
      providerMessageId,
      messageType: "text",
      content: "Hi! Do you have this kurti in size M?", // matches the real seeded fashion_size rule
      mediaUrl: null,
      mediaMimeType: null,
      providerMediaId: null,
      receivedAt: new Date(),
      phoneNumber: phone,
      displayHandle: null,
      displayName: "Stuck Retry Test Customer",
    };

    // --- First attempt: the provider send fails once, exactly like a real network/API error ---
    simulateSendFailuresFor(phone, 1);

    let firstAttemptThrew = false;
    try {
      await processInboundMessage(supabase, bizId, normalized);
    } catch {
      firstAttemptThrew = true;
    }
    record("first attempt propagates the provider failure (matches the real webhook route's failure path)", firstAttemptThrew);

    const { data: contact } = await supabase.from("contacts").select("id").eq("business_id", bizId).single();
    const { data: inboundAfterFirst } = await supabase
      .from("messages")
      .select("id, automation_processed_at")
      .eq("business_id", bizId)
      .eq("direction", "inbound")
      .single();
    const { data: outboundAfterFirst } = await supabase
      .from("messages")
      .select("id, send_status")
      .eq("business_id", bizId)
      .eq("direction", "outbound");

    record(
      "after the failed attempt: inbound message NOT marked processed, exactly one outbound row exists at send_status='pending_send'",
      inboundAfterFirst?.automation_processed_at === null &&
        outboundAfterFirst?.length === 1 &&
        outboundAfterFirst[0].send_status === "pending_send",
      JSON.stringify({ inboundAfterFirst, outboundAfterFirst }),
    );

    const replyBeforeRetry = await replyVisibleToOwner(bizId, contact.id, inboundAfterFirst.id);
    record(
      "the stuck pending_send reply is NOT shown to the owner (reply-visibility fix)",
      replyBeforeRetry === null,
      `replyVisibleToOwner returned: ${JSON.stringify(replyBeforeRetry)}`,
    );

    // --- Second attempt (what webhook recovery does: re-derive the same normalized message
    // from storage and call processInboundMessage again): this time the provider succeeds.
    // claimMessageForProcessing() only reclaims a message once its claim is stale
    // (MESSAGE_CLAIM_STALE_MS = 2 minutes) -- a real recovery cycle only ever runs that long
    // after the original attempt anyway (webhook_events' own claim_stuck_webhook_event has
    // its own, separate timeout), so this backdates the claim to represent that elapsed time
    // rather than actually sleeping the test for 2+ minutes. ---
    const { error: backdateError } = await supabase
      .from("messages")
      .update({ automation_claimed_at: new Date(Date.now() - 3 * 60 * 1000).toISOString() })
      .eq("id", inboundAfterFirst.id);
    if (backdateError) throw new Error(`Failed to backdate the message claim: ${backdateError.message}`);

    let secondAttemptThrew = false;
    try {
      await processInboundMessage(supabase, bizId, normalized);
    } catch (error) {
      secondAttemptThrew = true;
      console.error(error);
    }
    record("retry (simulating webhook recovery) succeeds -- the send is genuinely re-attempted, not silently skipped", !secondAttemptThrew);

    const { data: inboundAfterRetry } = await supabase
      .from("messages")
      .select("id, automation_processed_at")
      .eq("id", inboundAfterFirst.id)
      .single();
    const { data: outboundAfterRetry } = await supabase
      .from("messages")
      .select("id, send_status, content")
      .eq("business_id", bizId)
      .eq("direction", "outbound");

    record(
      "after retry: inbound marked processed, still exactly ONE outbound row (never duplicated), now send_status='sent'",
      inboundAfterRetry?.automation_processed_at !== null &&
        outboundAfterRetry?.length === 1 &&
        outboundAfterRetry[0].send_status === "sent" &&
        outboundAfterRetry[0].id === outboundAfterFirst[0].id,
      JSON.stringify({ inboundAfterRetry, outboundAfterRetry }),
    );

    const replyAfterRetry = await replyVisibleToOwner(bizId, contact.id, inboundAfterFirst.id);
    record(
      "the reply is now correctly visible to the owner once genuinely sent",
      replyAfterRetry === "Let us know the item and your size, and we'll confirm availability right away.",
      `replyVisibleToOwner returned: ${JSON.stringify(replyAfterRetry)}`,
    );

    const failed = results.filter((r) => !r.pass);
    console.log(`\n${results.length - failed.length}/${results.length} passed.`);
    if (failed.length > 0) process.exitCode = 1;
  } finally {
    if (bizId) {
      const { error } = await supabase.from("businesses").delete().eq("id", bizId);
      if (error) console.error(`Cleanup failed for business ${bizId}: ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
