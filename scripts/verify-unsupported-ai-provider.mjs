// Audit finding #1, live end-to-end proof: with AI_PROVIDER_CLASSIFICATION set to an
// unsupported value (this script must be run against a dev server started with exactly
// that), a smart-mode business's escalation to Layer 2 must degrade to
// NEEDS_ATTENTION/ai_unavailable -- never crash webhook processing. Before the fix,
// getAIProvider() was called outside escalateToAiLayer's try/catch, so this exact
// configuration threw synchronously and propagated all the way to the webhook route's outer
// catch, marking the event 'failed' for what should have been a routine, safely-degraded
// AI-unavailable outcome.
//
// Requires: the dev server running at DEV_SERVER_URL with AI_PROVIDER_CLASSIFICATION set to
// an unsupported value, e.g.:
//   AI_PROVIDER_CLASSIFICATION=claude-not-yet-real npm run dev
// Usage: node scripts/verify-unsupported-ai-provider.mjs

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
let bizId;

async function main() {
  const providerAccountId = `unsupported-provider-test-${suffix}`;
  const phone = `+91700${suffix}z`;

  try {
    const { data: biz, error: bizError } = await supabase
      .from("businesses")
      .insert({ name: `Unsupported Provider Test Biz ${suffix}`, vertical: "fashion", subscription_status: "active" })
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
    await supabase
      .from("business_settings")
      .upsert({ business_id: bizId, setting_key: "automation_mode", setting_value: "smart" }, { onConflict: "business_id,setting_key" });

    const res = await fetch(`${DEV_SERVER_URL}/api/webhooks/whatsapp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessProviderAccountId: providerAccountId, fromPhoneNumber: phone, text: "no keyword matches this at all" }),
    });
    const body = await res.json();
    await new Promise((r) => setTimeout(r, 500));

    const { data: identity } = await supabase
      .from("contact_channel_identities")
      .select("contact_id")
      .eq("business_id", bizId)
      .eq("provider_user_id", phone)
      .maybeSingle();
    const { data: item } = await supabase
      .from("owner_attention_queue")
      .select("reason")
      .eq("contact_id", identity?.contact_id)
      .maybeSingle();
    const { data: message } = await supabase
      .from("messages")
      .select("id")
      .eq("contact_id", identity?.contact_id)
      .eq("direction", "inbound")
      .maybeSingle();
    const { data: log } = await supabase
      .from("automation_decision_log")
      .select("*")
      .eq("message_id", message?.id)
      .maybeSingle();
    const { data: webhookEvent } = await supabase
      .from("webhook_events")
      .select("status")
      .eq("business_id", bizId)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const pass =
      res.status === 200 &&
      body.ok === true &&
      item?.reason === "ai_unavailable" &&
      log?.fallback_reason === "provider_unavailable" &&
      log?.ai_provider === "claude-not-yet-real" &&
      webhookEvent?.status === "processed";

    console.log(`${pass ? "PASS" : "FAIL"} -- unsupported AI_PROVIDER_CLASSIFICATION degrades to ai_unavailable, webhook stays processed`);
    console.log(JSON.stringify({ webhookStatus: res.status, body, attentionReason: item?.reason, log, webhookEventStatus: webhookEvent?.status }, null, 2));
    if (!pass) process.exitCode = 1;
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
