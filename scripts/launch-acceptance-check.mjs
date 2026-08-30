// Launch Acceptance pass (ADR-0020): posts real inbound webhook payloads at
// /api/webhooks/{whatsapp,instagram} for every vertical x channel combination and verifies
// the FULL pipeline end-to-end against real Postgres state -- not fixture data inserted
// directly, but the actual webhook -> durability -> processInboundMessage() path a real
// customer message would take. Requires:
//   1. The dev server running at DEV_SERVER_URL (default http://localhost:3100)
//   2. scripts/seed-dev-preview-data.mjs already run (provides the 5 fixture businesses,
//      each connected on both channels -- this script's provider_account_id values below
//      are exactly what that script seeds)
//
// Re-runnable: every scenario uses a fresh provider_user_id (random suffix) so each run
// creates new contacts rather than colliding with a previous run's.
//
// Usage: node scripts/launch-acceptance-check.mjs

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

const BIZ = {
  fashion: "dead0001-0000-0000-0000-000000000001",
  baker: "dead0002-0000-0000-0000-000000000002",
  service: "dead0003-0000-0000-0000-000000000003",
  tutor: "dead0004-0000-0000-0000-000000000004",
  gift: "dead0005-0000-0000-0000-000000000005",
};

const rand = () => Math.random().toString(36).slice(2, 10);

async function postWebhook(channel, body) {
  const res = await fetch(`${DEV_SERVER_URL}/api/webhooks/${channel}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function waitForWebhookProcessed(providerEventId, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase
      .from("webhook_events")
      .select("status")
      .eq("provider_event_id", providerEventId)
      .maybeSingle();
    if (data && (data.status === "processed" || data.status === "failed")) return data.status;
    await new Promise((r) => setTimeout(r, 150));
  }
  return "timeout";
}

async function findIdentity(businessId, channelName, providerUserId) {
  const { data: channel } = await supabase.from("channels").select("id").eq("name", channelName).single();
  const { data } = await supabase
    .from("contact_channel_identities")
    .select("id, contact_id, opted_out_at, contacts(name, pipeline_stage_id)")
    .eq("business_id", businessId)
    .eq("channel_id", channel.id)
    .eq("provider_user_id", providerUserId)
    .maybeSingle();
  return data;
}

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} -- ${name}${detail ? ` (${detail})` : ""}`);
}

async function runMatchScenario({ name, vertical, channel, text, expectedReplySubstring, displayField, display }) {
  const businessId = BIZ[vertical];
  const providerEventId = `la-${rand()}`;
  const providerUserId = channel === "whatsapp" ? `+91900000${rand().slice(0, 4)}` : `ig-${rand()}`;

  const body =
    channel === "whatsapp"
      ? { businessProviderAccountId: `dev-wa-${businessId}`, providerEventId, fromPhoneNumber: providerUserId, [displayField]: display, text }
      : { businessProviderAccountId: `dev-ig-${businessId}`, providerEventId, fromInstagramScopedId: providerUserId, [displayField]: display, text };

  const { status } = await postWebhook(channel, body);
  if (status !== 200) return record(name, false, `webhook POST returned ${status}`);

  const processStatus = await waitForWebhookProcessed(providerEventId);
  if (processStatus !== "processed") return record(name, false, `webhook_events status=${processStatus}`);

  const identity = await findIdentity(businessId, channel, providerUserId);
  if (!identity) return record(name, false, "no contact_channel_identity created");
  if (identity.contacts.pipeline_stage_id === null) return record(name, false, "contact has no initial pipeline stage");
  if (identity.contacts.name !== display) return record(name, false, `contacts.name = ${JSON.stringify(identity.contacts.name)}, expected ${JSON.stringify(display)}`);

  const { data: reply } = await supabase
    .from("messages")
    .select("content, send_status")
    .eq("contact_id", identity.contact_id)
    .eq("direction", "outbound")
    .eq("is_auto_reply", true)
    .maybeSingle();
  if (!reply) return record(name, false, "no auto-reply message recorded");
  if (reply.send_status !== "sent") return record(name, false, `auto-reply send_status=${reply.send_status}`);
  if (!reply.content.includes(expectedReplySubstring)) {
    return record(name, false, `auto-reply content did not match expected rule (got: "${reply.content.slice(0, 40)}...")`);
  }

  record(name, true, `contact=${identity.contact_id.slice(0, 8)} name="${display}" reply matched`);
}

async function runNoMatchScenario({ name, vertical, channel, text, expectedReason }) {
  const businessId = BIZ[vertical];
  const providerEventId = `la-${rand()}`;
  const providerUserId = channel === "whatsapp" ? `+91900000${rand().slice(0, 4)}` : `ig-${rand()}`;
  const display = "Regression Tester";

  const body =
    channel === "whatsapp"
      ? { businessProviderAccountId: `dev-wa-${businessId}`, providerEventId, fromPhoneNumber: providerUserId, displayName: display, text }
      : { businessProviderAccountId: `dev-ig-${businessId}`, providerEventId, fromInstagramScopedId: providerUserId, displayHandle: display, text };

  const { status } = await postWebhook(channel, body);
  if (status !== 200) return record(name, false, `webhook POST returned ${status}`);

  const processStatus = await waitForWebhookProcessed(providerEventId);
  if (processStatus !== "processed") return record(name, false, `webhook_events status=${processStatus}`);

  const identity = await findIdentity(businessId, channel, providerUserId);
  if (!identity) return record(name, false, "no contact_channel_identity created");

  const { data: attention } = await supabase
    .from("owner_attention_queue")
    .select("reason")
    .eq("contact_id", identity.contact_id)
    .is("resolved_at", null)
    .maybeSingle();
  if (!attention) return record(name, false, "no owner_attention_queue row created");
  if (attention.reason !== expectedReason) return record(name, false, `attention reason="${attention.reason}", expected "${expectedReason}"`);

  const { data: reply } = await supabase
    .from("messages")
    .select("id")
    .eq("contact_id", identity.contact_id)
    .eq("direction", "outbound")
    .maybeSingle();
  if (reply) return record(name, false, "an auto-reply was sent when none should have matched");

  record(name, true, `attention queued (${attention.reason}), no auto-reply sent`);
}

async function runOptOutScenario() {
  const name = "Opt-out: tutor/whatsapp 'STOP'";
  const businessId = BIZ.tutor;
  const providerEventId = `la-${rand()}`;
  const providerUserId = `+91900000${rand().slice(0, 4)}`;

  const { status } = await postWebhook("whatsapp", {
    businessProviderAccountId: `dev-wa-${businessId}`,
    providerEventId,
    fromPhoneNumber: providerUserId,
    displayName: "Opt Out Tester",
    text: "STOP",
  });
  if (status !== 200) return record(name, false, `webhook POST returned ${status}`);

  const processStatus = await waitForWebhookProcessed(providerEventId);
  if (processStatus !== "processed") return record(name, false, `webhook_events status=${processStatus}`);

  const identity = await findIdentity(businessId, "whatsapp", providerUserId);
  if (!identity) return record(name, false, "no contact_channel_identity created");
  if (!identity.opted_out_at) return record(name, false, "opted_out_at was not set");

  record(name, true, `opted_out_at=${identity.opted_out_at}`);
}

async function runMultiChannelNoMergeScenario() {
  const name = "Multi-channel: same person on WhatsApp + Instagram stays two contacts";
  const businessId = BIZ.fashion;
  const waEventId = `la-${rand()}`;
  const igEventId = `la-${rand()}`;
  const waUserId = `+91900000${rand().slice(0, 4)}`;
  const igUserId = `ig-${rand()}`;
  const display = "Cross Channel Customer";

  const wa = await postWebhook("whatsapp", {
    businessProviderAccountId: `dev-wa-${businessId}`,
    providerEventId: waEventId,
    fromPhoneNumber: waUserId,
    displayName: display,
    text: "What's the price of the red saree?",
  });
  const ig = await postWebhook("instagram", {
    businessProviderAccountId: `dev-ig-${businessId}`,
    providerEventId: igEventId,
    fromInstagramScopedId: igUserId,
    displayHandle: display,
    text: "What's the price of the red saree?",
  });
  if (wa.status !== 200 || ig.status !== 200) return record(name, false, `POST statuses wa=${wa.status} ig=${ig.status}`);

  const waStatus = await waitForWebhookProcessed(waEventId);
  const igStatus = await waitForWebhookProcessed(igEventId);
  if (waStatus !== "processed" || igStatus !== "processed") {
    return record(name, false, `webhook_events statuses wa=${waStatus} ig=${igStatus}`);
  }

  const waIdentity = await findIdentity(businessId, "whatsapp", waUserId);
  const igIdentity = await findIdentity(businessId, "instagram", igUserId);
  if (!waIdentity || !igIdentity) return record(name, false, "one or both identities missing");
  if (waIdentity.contact_id === igIdentity.contact_id) {
    return record(name, false, "same contact_id used for both channels -- unwanted auto-merge (Non-Negotiable Rule 2 violation)");
  }

  record(name, true, `wa contact=${waIdentity.contact_id.slice(0, 8)} ig contact=${igIdentity.contact_id.slice(0, 8)} -- correctly separate`);
}

async function main() {
  console.log(`Launch Acceptance check against ${DEV_SERVER_URL}\n`);

  // 10 vertical x channel combinations, each using a real seeded internal_reply_rules keyword.
  await runMatchScenario({ name: "fashion/whatsapp: price", vertical: "fashion", channel: "whatsapp", text: "What's the price of the blue kurta?", expectedReplySubstring: "share the exact price", displayField: "displayName", display: "Test Fashion WA" });
  await runMatchScenario({ name: "fashion/instagram: size", vertical: "fashion", channel: "instagram", text: "Is this available in size M?", expectedReplySubstring: "confirm availability", displayField: "displayHandle", display: "Test Fashion IG" });
  await runMatchScenario({ name: "tutor/whatsapp: timing", vertical: "tutor", channel: "whatsapp", text: "What are your class timings?", expectedReplySubstring: "available slots", displayField: "displayName", display: "Test Tutor WA" });
  await runMatchScenario({ name: "tutor/instagram: trial", vertical: "tutor", channel: "instagram", text: "Do you offer a trial class?", expectedReplySubstring: "trial class", displayField: "displayHandle", display: "Test Tutor IG" });
  await runMatchScenario({ name: "service/whatsapp: availability", vertical: "service", channel: "whatsapp", text: "Are you available this Saturday?", expectedReplySubstring: "check availability", displayField: "displayName", display: "Test Service WA" });
  await runMatchScenario({ name: "service/instagram: package", vertical: "service", channel: "instagram", text: "What packages do you offer?", expectedReplySubstring: "right package", displayField: "displayHandle", display: "Test Service IG" });
  await runMatchScenario({ name: "baker/whatsapp: eggless", vertical: "baker", channel: "whatsapp", text: "Can I get eggless cake please?", expectedReplySubstring: "eggless is available", displayField: "displayName", display: "Test Baker WA" });
  await runMatchScenario({ name: "baker/instagram: custom design", vertical: "baker", channel: "instagram", text: "Can you make a custom design cake?", expectedReplySubstring: "reference photo", displayField: "displayHandle", display: "Test Baker IG" });
  await runMatchScenario({ name: "gift/whatsapp: budget", vertical: "gift", channel: "whatsapp", text: "What budget should I keep in mind?", expectedReplySubstring: "budget range", displayField: "displayName", display: "Test Gift WA" });
  await runMatchScenario({ name: "gift/instagram: personalization", vertical: "gift", channel: "instagram", text: "Can you personalize this?", expectedReplySubstring: "personalize this", displayField: "displayHandle", display: "Test Gift IG" });

  // Cross-vertical regression: a baker-only keyword sent to a fashion business must not match.
  await runNoMatchScenario({ name: "Cross-vertical regression: 'flavour' to fashion business", vertical: "fashion", channel: "whatsapp", text: "What flavour options do you have?", expectedReason: "unmatched_message" });

  // Genuinely unmatched message via the real webhook path (not fixture-inserted).
  await runNoMatchScenario({ name: "Unmatched message via real webhook", vertical: "service", channel: "instagram", text: "asdkjfh random unrelated text", expectedReason: "unmatched_message" });

  await runOptOutScenario();
  await runMultiChannelNoMergeScenario();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) {
    console.log("\nFailures:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
