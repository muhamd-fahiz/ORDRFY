// Final Phase 2 hardening pass, audit finding #2's concurrency half
// (docs/architecture/decisions/0038-phase2-final-hardening.md): proves that two truly
// concurrent attempts at the SAME inbound message (same provider_message_id, fired via
// Promise.all so both requests are in flight simultaneously) result in the automation
// pipeline actually running exactly once, never twice. Before this fix, the duplicate-insert
// branch just checked "is automation_processed_at set" with no atomic claim in between --
// two callers could both observe it unset and both proceed to reprocess.
//
// Causal reasoning for why this is deterministic, not merely probably-true: only ONE of the
// two concurrent INSERTs can win the (provider, provider_message_id) unique constraint; the
// LOSER's failure can only be reported back to it AFTER the WINNER's insert has already
// committed (that is what a unique-constraint violation means). The winner's insert sets
// automation_claimed_at as part of that same statement, so by the time the loser's
// subsequent lookup runs, it is guaranteed to see the winner's fresh claim and correctly
// fail to acquire its own -- this holds regardless of exact request timing.
//
// Requires: the dev server running at DEV_SERVER_URL (default http://localhost:3100).
// Usage: node scripts/verify-atomic-message-claim.mjs

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

const suffix = Math.random().toString(36).slice(2, 10);
const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} -- ${name}${detail ? ` (${detail})` : ""}`);
}

let bizId;

async function sendInbound(providerAccountId, fromPhoneNumber, text, providerMessageId) {
  const res = await fetch(`${DEV_SERVER_URL}/api/webhooks/whatsapp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ businessProviderAccountId: providerAccountId, fromPhoneNumber, text, providerMessageId }),
  });
  return { status: res.status, body: await res.json() };
}

async function main() {
  const providerAccountId = `atomic-claim-test-${suffix}`;
  const phone = `+91700${suffix}c`;
  const keyword = `xatomic${suffix}`;
  const providerMessageId = `atomic-claim-msg-${suffix}`;

  try {
    const { data: biz, error: bizError } = await supabase
      .from("businesses")
      .insert({ name: `Atomic Claim Test Biz ${suffix}`, vertical: "fashion", subscription_status: "active" })
      .select("id")
      .single();
    if (bizError) throw new Error(bizError.message);
    bizId = biz.id;

    const { data: waChannel } = await supabase.from("channels").select("id").eq("name", "whatsapp").single();
    await supabase.from("business_channel_connections").insert({
      business_id: bizId,
      channel_id: waChannel.id,
      provider_account_id: providerAccountId,
      connected: true,
    });
    await supabase.from("internal_reply_rules").insert({
      business_id: bizId,
      vertical: "fashion",
      rule_key: "atomic_claim_test_rule",
      trigger_keywords: [keyword],
      reply_text: "Atomic claim test reply",
    });

    // Fire two requests for the IDENTICAL provider_message_id, truly concurrently.
    const [first, second] = await Promise.all([
      sendInbound(providerAccountId, phone, `asking about ${keyword}`, providerMessageId),
      sendInbound(providerAccountId, phone, `asking about ${keyword}`, providerMessageId),
    ]);
    record("both concurrent requests ack 200", first.status === 200 && second.status === 200, JSON.stringify({ first: first.status, second: second.status }));

    // Give both requests' after() callbacks time to finish.
    await new Promise((r) => setTimeout(r, 1500));

    const { count: messageCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("provider", "mock-whatsapp")
      .eq("provider_message_id", providerMessageId);
    record("exactly one inbound message row exists despite two concurrent deliveries", messageCount === 1, `count=${messageCount}`);

    const { data: identity } = await supabase
      .from("contact_channel_identities")
      .select("contact_id")
      .eq("business_id", bizId)
      .eq("provider_user_id", phone)
      .maybeSingle();
    const { count: outboundCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", identity?.contact_id)
      .eq("direction", "outbound");
    record(
      "the automation pipeline ran exactly once -- exactly one reply sent, not two",
      outboundCount === 1,
      `outboundCount=${outboundCount}`,
    );

    const { data: messageState } = await supabase
      .from("messages")
      .select("automation_claimed_at, automation_processed_at")
      .eq("provider", "mock-whatsapp")
      .eq("provider_message_id", providerMessageId)
      .single();
    record(
      "the message ends up claimed and marked processed",
      messageState?.automation_claimed_at !== null && messageState?.automation_processed_at !== null,
      JSON.stringify(messageState),
    );

    const failed = results.filter((r) => !r.pass);
    console.log(`\n${results.length - failed.length}/${results.length} passed.`);
    if (failed.length > 0) process.exitCode = 1;
  } finally {
    if (bizId) {
      await supabase.from("webhook_events").delete().eq("business_id", bizId);
      await supabase.from("businesses").delete().eq("id", bizId);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
