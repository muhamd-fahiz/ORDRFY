// Phase 2 verification (docs/architecture/decisions/0036-phase2-ai-classification-wiring.md):
// proves the Layer 1 -> Layer 2 -> Layer 4 fallback chain end-to-end through the REAL
// webhook route (not a fixture insert or a direct function call), matching this project's
// own established "test through the real path" convention (ADR-0023, scripts/launch-acceptance-check.mjs).
//
// Covers: the rules_only regression guard (automation_mode absent must be byte-identical to
// pre-Phase-2 behavior, including zero new writes), a Layer 1 direct match under smart mode
// (audited but not re-classified), a Layer 4 AUTOMATE_REPLY via the mock's default
// high-confidence result, NEEDS_ATTENTION on low confidence, NEEDS_ATTENTION on a simulated
// provider error (confirming the failure is caught locally and never marks the webhook event
// 'failed'), the candidate-rule boundary rejecting a fabricated rule id, the 'ai_assisted'
// mode's deliberate but now OBSERVABLE inertness (audit finding #6), the kill switch still
// gating before any AI call, and (audit finding #8) that candidate rules are correctly
// scoped by tenant, active status, vertical, and language -- four "trap rule" scenarios that
// would each match the test message directly if candidate scoping ever leaked.
//
// Requires: the dev server running at DEV_SERVER_URL (default http://localhost:3100).
// Usage: node scripts/verify-phase2-ai-classification-fallback.mjs

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

async function sendInbound(fromPhoneNumber, text) {
  const res = await fetch(`${DEV_SERVER_URL}/api/webhooks/whatsapp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ businessProviderAccountId: PROVIDER_ACCOUNT_ID, fromPhoneNumber, text }),
  });
  const body = await res.json();
  // The route processes inbound messages in an after() callback that runs post-response --
  // give it a moment to finish before asserting on DB state, same as verify-webhook-recovery.mjs.
  await new Promise((r) => setTimeout(r, 500));
  return { status: res.status, body };
}

async function latestDecisionLogFor(businessId, phone) {
  const { data: identity } = await supabase
    .from("contact_channel_identities")
    .select("contact_id")
    .eq("business_id", businessId)
    .eq("provider_user_id", phone)
    .maybeSingle();
  if (!identity) return null;
  const { data: message } = await supabase
    .from("messages")
    .select("id")
    .eq("contact_id", identity.contact_id)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!message) return null;
  const { data: log } = await supabase
    .from("automation_decision_log")
    .select("*")
    .eq("message_id", message.id)
    .maybeSingle();
  return log ?? null;
}

async function latestAttentionReasonFor(businessId, phone) {
  const { data: identity } = await supabase
    .from("contact_channel_identities")
    .select("contact_id")
    .eq("business_id", businessId)
    .eq("provider_user_id", phone)
    .maybeSingle();
  if (!identity) return null;
  const { data: item } = await supabase
    .from("owner_attention_queue")
    .select("reason")
    .eq("contact_id", identity.contact_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return item?.reason ?? null;
}

async function outboundCountFor(businessId, phone) {
  const { data: identity } = await supabase
    .from("contact_channel_identities")
    .select("contact_id")
    .eq("business_id", businessId)
    .eq("provider_user_id", phone)
    .maybeSingle();
  if (!identity) return 0;
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", identity.contact_id)
    .eq("direction", "outbound");
  return count ?? 0;
}

async function setAutomationMode(businessId, mode) {
  if (mode === null) {
    await supabase.from("business_settings").delete().eq("business_id", businessId).eq("setting_key", "automation_mode");
    return;
  }
  await supabase
    .from("business_settings")
    .upsert(
      { business_id: businessId, setting_key: "automation_mode", setting_value: mode },
      { onConflict: "business_id,setting_key" },
    );
}

const PROVIDER_ACCOUNT_ID = `phase2-test-account-${suffix}`;
let bizId;
let ruleId;

async function main() {
  try {
    // --- Seed: one business, connected on WhatsApp, one keyword rule --------------------
    const { data: biz, error: bizError } = await supabase
      .from("businesses")
      .insert({ name: `Phase 2 Test Biz ${suffix}`, vertical: "fashion", subscription_status: "active" })
      .select("id")
      .single();
    if (bizError) throw new Error(`Failed to seed business: ${bizError.message}`);
    bizId = biz.id;

    const { data: whatsappChannel } = await supabase.from("channels").select("id").eq("name", "whatsapp").single();
    const { error: connError } = await supabase.from("business_channel_connections").insert({
      business_id: bizId,
      channel_id: whatsappChannel.id,
      provider_account_id: PROVIDER_ACCOUNT_ID,
      connected: true,
    });
    if (connError) throw new Error(`Failed to seed channel connection: ${connError.message}`);

    // A keyword with zero overlap with any real seeded vertical-default rule (which already
    // include ordinary words like "price") -- otherwise a Layer 1 substring match could hit
    // both this rule and a pre-existing one, making which rule wins seed-data-order-dependent
    // rather than a property of the code path actually under test here.
    const uniqueKeyword = `xkwd${suffix}`;
    const { data: rule, error: ruleError } = await supabase
      .from("internal_reply_rules")
      .insert({
        business_id: bizId,
        vertical: "fashion",
        rule_key: "phase2_test_rule",
        trigger_keywords: [uniqueKeyword],
        reply_text: "Rule reply: our price is 999.",
      })
      .select("id")
      .single();
    if (ruleError) throw new Error(`Failed to seed rule: ${ruleError.message}`);
    ruleId = rule.id;

    // --- Scenario 1: automation_mode absent (rules_only default) -- regression guard ----
    {
      const phone = `+91700${suffix}1`;
      await sendInbound(phone, "no keyword here at all");
      const reason = await latestAttentionReasonFor(bizId, phone);
      const log = await latestDecisionLogFor(bizId, phone);
      record(
        "rules_only default: unmatched message queued exactly as before, zero decision-log rows",
        reason === "unmatched_message" && log === null,
        `reason=${reason}, log=${log ? "present" : "null"}`,
      );
    }

    await setAutomationMode(bizId, "smart");

    // --- Scenario 2: smart mode, Layer 1 direct keyword match ---------------------------
    {
      const phone = `+91700${suffix}2`;
      await sendInbound(phone, `what is the ${uniqueKeyword}?`);
      const sent = await outboundCountFor(bizId, phone);
      const log = await latestDecisionLogFor(bizId, phone);
      record(
        "smart mode + Layer 1 match: auto-reply sent, audited as layer1_rules/AUTOMATE_REPLY",
        sent === 1 && log?.decision_source === "layer1_rules" && log?.action === "AUTOMATE_REPLY" && log?.matched_rule_id === ruleId,
        JSON.stringify(log),
      );
    }

    // --- Scenario 3: smart mode, Layer 1 no_match, AI default high-confidence match -----
    // The mock's default behavior picks the first candidate rule -- which candidate that is
    // depends on seed-data ordering, not on anything this scenario is testing, so only the
    // decision mechanics (Layer 4 ran, chose a real candidate, sent it) are asserted here.
    {
      const phone = `+91700${suffix}3`;
      await sendInbound(phone, "ee dressinte vila enthaanu");
      const sent = await outboundCountFor(bizId, phone);
      const log = await latestDecisionLogFor(bizId, phone);
      record(
        "smart mode + AI high confidence: auto-reply sent via Layer 4, audited as layer4_decision/AUTOMATE_REPLY",
        sent === 1 && log?.decision_source === "layer4_decision" && log?.action === "AUTOMATE_REPLY" && log?.matched_rule_id !== null && log?.ai_provider === "mock",
        JSON.stringify(log),
      );
    }

    // --- Scenario 4: smart mode, AI low confidence -> Needs Attention -------------------
    {
      const phone = `+91700${suffix}4`;
      await sendInbound(phone, "SIMULATE_AI_LOW_CONFIDENCE some ambiguous question");
      const reason = await latestAttentionReasonFor(bizId, phone);
      const log = await latestDecisionLogFor(bizId, phone);
      record(
        "smart mode + AI low confidence: queued as ai_low_confidence, never auto-replied",
        reason === "ai_low_confidence" && log?.action === "NEEDS_ATTENTION" && log?.escalation_reason === "ai_low_confidence",
        JSON.stringify({ reason, log }),
      );
    }

    // --- Scenario 5: smart mode, simulated provider error -- must not mark webhook failed ---
    {
      const phone = `+91700${suffix}5`;
      const { body } = await sendInbound(phone, "SIMULATE_AI_ERROR trigger a provider failure");
      const reason = await latestAttentionReasonFor(bizId, phone);
      const log = await latestDecisionLogFor(bizId, phone);
      const { data: webhookEvent } = await supabase
        .from("webhook_events")
        .select("status")
        .eq("business_id", bizId)
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      record(
        "smart mode + AI provider error: falls back to ai_unavailable, webhook event still marked processed (not failed)",
        body.ok === true && reason === "ai_unavailable" && log?.fallback_reason === "provider_error" && webhookEvent?.status === "processed",
        JSON.stringify({ reason, fallbackReason: log?.fallback_reason, webhookStatus: webhookEvent?.status }),
      );
    }

    // --- Scenario 6: smart mode, AI returns a rule id outside the candidate set ---------
    {
      const phone = `+91700${suffix}6`;
      await sendInbound(phone, "SIMULATE_AI_UNKNOWN_RULE asking something");
      const sent = await outboundCountFor(bizId, phone);
      const reason = await latestAttentionReasonFor(bizId, phone);
      const log = await latestDecisionLogFor(bizId, phone);
      record(
        "smart mode + AI invents a rule id: never auto-replied, matched_rule_id nulled out, queued instead",
        sent === 0 && reason === "ai_low_confidence" && log?.matched_rule_id === null,
        JSON.stringify({ sent, reason, matchedRuleId: log?.matched_rule_id }),
      );
    }

    // --- Scenario 7: ai_assisted mode is inert in this phase, but no longer SILENTLY so
    // (audit finding #6) -- must still log that the configured mode isn't honored yet. -----
    await setAutomationMode(bizId, "ai_assisted");
    {
      const phone = `+91700${suffix}7`;
      await sendInbound(phone, "another unmatched message entirely");
      const reason = await latestAttentionReasonFor(bizId, phone);
      const log = await latestDecisionLogFor(bizId, phone);
      const { data: identity } = await supabase
        .from("contact_channel_identities")
        .select("contact_id")
        .eq("business_id", bizId)
        .eq("provider_user_id", phone)
        .maybeSingle();
      const { data: activity } = await supabase
        .from("activity_log")
        .select("event_type, event_detail")
        .eq("business_id", bizId)
        .eq("contact_id", identity?.contact_id)
        .eq("event_type", "automation_mode_not_yet_supported")
        .maybeSingle();
      record(
        "ai_assisted mode: same outcome as rules_only, but now observably logged as not-yet-supported (not silent)",
        reason === "unmatched_message" && log === null && activity?.event_detail?.configured_mode === "ai_assisted",
        `reason=${reason}, log=${log ? "present" : "null"}, activity=${JSON.stringify(activity)}`,
      );
    }

    // --- Scenario 8: kill switch still gates before any AI call ------------------------
    await setAutomationMode(bizId, "smart");
    await supabase.from("businesses").update({ automation_paused: true }).eq("id", bizId);
    {
      const phone = `+91700${suffix}8`;
      await sendInbound(phone, "would have matched via AI if not paused");
      const log = await latestDecisionLogFor(bizId, phone);
      const reason = await latestAttentionReasonFor(bizId, phone);
      record(
        "kill switch: no AI call, no decision-log row, no attention item -- automation fully suppressed",
        log === null && reason === null,
        `log=${log ? "present" : "null"}, reason=${reason}`,
      );
    }
    await supabase.from("businesses").update({ automation_paused: false }).eq("id", bizId);

    // --- Scenario 9-12 (audit finding #8): candidate rules are correctly scoped by tenant,
    // vertical, language, and active status -- each seeds a "trap" rule that WOULD match the
    // test message if candidate scoping leaked, and confirms it never does. If a trap rule
    // ever leaked into the candidate set, Layer 1's own substring match would catch it
    // directly (decision_source='layer1_rules'), so asserting decision_source='layer4_decision'
    // (Layer 1 correctly found no match) is itself proof the trap rule was never a candidate,
    // in addition to matched_rule_id never equalling the trap rule's id. --------------------
    {
      // Scenario 9: a rule belonging to a DIFFERENT business must never leak in.
      const trapKeyword = `traptenant${suffix}`;
      const { data: otherBiz } = await supabase
        .from("businesses")
        .insert({ name: `Phase 2 Other Biz ${suffix}`, vertical: "fashion", subscription_status: "active" })
        .select("id")
        .single();
      const { data: trapRule } = await supabase
        .from("internal_reply_rules")
        .insert({ business_id: otherBiz.id, vertical: "fashion", rule_key: "trap_tenant_rule", trigger_keywords: [trapKeyword], reply_text: "Should never be sent to business A" })
        .select("id")
        .single();

      const phone = `+91700${suffix}9`;
      await sendInbound(phone, `asking about ${trapKeyword} here`);
      const log = await latestDecisionLogFor(bizId, phone);
      record(
        "candidate scoping: a different business's rule never leaks in, even with a matching keyword",
        log?.decision_source === "layer4_decision" && log?.matched_rule_id !== trapRule.id,
        JSON.stringify(log),
      );

      await supabase.from("internal_reply_rules").delete().eq("id", trapRule.id);
      await supabase.from("businesses").delete().eq("id", otherBiz.id);
    }

    {
      // Scenario 10: an INACTIVE rule for the SAME business must never leak in.
      const trapKeyword = `trapinactive${suffix}`;
      const { data: trapRule } = await supabase
        .from("internal_reply_rules")
        .insert({ business_id: bizId, vertical: "fashion", rule_key: "trap_inactive_rule", trigger_keywords: [trapKeyword], reply_text: "Should never be sent", active: false })
        .select("id")
        .single();

      const phone = `+91700${suffix}a`;
      await sendInbound(phone, `asking about ${trapKeyword} here`);
      const log = await latestDecisionLogFor(bizId, phone);
      record(
        "candidate scoping: an inactive rule never leaks in",
        log?.decision_source === "layer4_decision" && log?.matched_rule_id !== trapRule.id,
        JSON.stringify(log),
      );
    }

    {
      // Scenario 11: a rule for the SAME business but a DIFFERENT vertical must never leak in.
      const trapKeyword = `trapvertical${suffix}`;
      const { data: trapRule } = await supabase
        .from("internal_reply_rules")
        .insert({ business_id: bizId, vertical: "tutor", rule_key: "trap_vertical_rule", trigger_keywords: [trapKeyword], reply_text: "Should never be sent" })
        .select("id")
        .single();

      const phone = `+91700${suffix}b`;
      await sendInbound(phone, `asking about ${trapKeyword} here`);
      const log = await latestDecisionLogFor(bizId, phone);
      record(
        "candidate scoping: a rule for a different vertical never leaks in",
        log?.decision_source === "layer4_decision" && log?.matched_rule_id !== trapRule.id,
        JSON.stringify(log),
      );
    }

    {
      // Scenario 12: a rule for the SAME business/vertical but a DIFFERENT language must
      // never leak in (this business's preferred_language defaults to 'en').
      const trapKeyword = `traplanguage${suffix}`;
      const { data: trapRule } = await supabase
        .from("internal_reply_rules")
        .insert({ business_id: bizId, vertical: "fashion", rule_key: "trap_language_rule", trigger_keywords: [trapKeyword], reply_text: "Should never be sent", language: "hi" })
        .select("id")
        .single();

      const phone = `+91700${suffix}c`;
      await sendInbound(phone, `asking about ${trapKeyword} here`);
      const log = await latestDecisionLogFor(bizId, phone);
      record(
        "candidate scoping: a rule in a different language never leaks in",
        log?.decision_source === "layer4_decision" && log?.matched_rule_id !== trapRule.id,
        JSON.stringify(log),
      );
    }

    const failed = results.filter((r) => !r.pass);
    console.log(`\n${results.length - failed.length}/${results.length} passed.`);
    if (failed.length > 0) process.exitCode = 1;
  } finally {
    // --- Cleanup: webhook_events.business_id has no ON DELETE CASCADE (known gap, see
    // scripts/verify-webhook-recovery.mjs's own header) -- delete it first, then the
    // business, which cascades to every other child table.
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
