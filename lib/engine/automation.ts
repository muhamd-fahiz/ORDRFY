import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/database.types";
import type { NormalizedInboundMessage } from "@/lib/channels/types";
import { getChannelProvider } from "@/lib/channels/factory";
import { getAIProvider, getConfiguredProviderName, AIProviderUnavailableError } from "@/lib/ai/factory";
import { enforceCandidateRuleBoundary } from "@/lib/ai/validation";
import { resolveOrCreateContact, type ResolvedContact } from "./contact-resolution";
import { matchKeywordRule, matchesOptOutKeyword, type MatchableRule } from "./automation-matching";
import { isAutomationEligibleForBilling, type SubscriptionStatus } from "./trial-eligibility";
import {
  decideAction,
  DEFAULT_DECISION_THRESHOLDS,
  type AutomationMode,
  type ClassificationResult,
} from "./automation-decision";
import { recordAutomationDecision } from "./decision-audit";

type Client = SupabaseClient<Database>;

const DEFAULT_TRIAL_GRACE_PERIOD_DAYS = 3;
const AI_CALL_TIMEOUT_MS = 8000;
// A live processing attempt (a handful of fast queries plus at most one AI_CALL_TIMEOUT_MS
// call) should finish in low single-digit seconds; anything still claimed after this long is
// treated as crashed, not slow. Deliberately far shorter than claim_stuck_webhook_event()'s
// own 10-minute default -- by the time recovery even looks at a webhook event, at least that
// long has already passed, so a much shorter message-level staleness window is still safely
// conservative against a live, merely-slow attempt.
const MESSAGE_CLAIM_STALE_MS = 2 * 60 * 1000;

async function insertAttentionItem(
  supabase: Client,
  businessId: string,
  contactId: string,
  reason: Database["public"]["Tables"]["owner_attention_queue"]["Row"]["reason"],
  referenceType: Database["public"]["Tables"]["owner_attention_queue"]["Row"]["reference_type"],
  referenceId?: string,
) {
  const { error } = await supabase.from("owner_attention_queue").insert({
    business_id: businessId,
    contact_id: contactId,
    reason,
    reference_type: referenceType,
    reference_id: referenceId ?? null,
  });
  if (error && error.code !== "23505") {
    throw new Error(`Failed to queue attention item: ${error.message}`);
  }
  // 23505 on idx_owner_attention_queue_reference_unique (reference_type, reference_id) WHERE
  // reference_id IS NOT NULL: this exact message/reminder was already queued by an earlier
  // attempt at processing it -- a genuinely idempotent no-op (audit finding #3), not an
  // error. Replaces a prior SELECT-then-INSERT here, which had a TOCTOU race under true
  // concurrency: two concurrent attempts could both SELECT and see nothing, then both
  // INSERT. The database-level unique index makes the guarantee real; a manual_flag entry
  // (reference_id NULL) is exempt by the index's own partial WHERE clause, since an owner
  // flagging the same contact more than once is not a duplicate.
}

async function logActivity(
  supabase: Client,
  businessId: string,
  contactId: string | null,
  eventType: string,
  eventDetail?: Record<string, unknown>,
) {
  await supabase.from("activity_log").insert({
    business_id: businessId,
    contact_id: contactId,
    event_type: eventType,
    event_detail: (eventDetail ?? null) as Json,
  });
}

/**
 * Reads business_settings(setting_key='automation_mode'). Distinguishes (audit finding #5)
 * "no row exists" -- a valid, expected state defaulting to 'rules_only', same
 * default-when-absent pattern as trial_grace_period_days above -- from a genuine lookup/
 * database error, which must propagate as a real, observable failure (caught by the webhook
 * route's outer handler, marked failed, and now safely retryable -- see this file's
 * processInboundMessage) rather than being silently treated as "this business is rules_only."
 */
async function getAutomationMode(supabase: Client, businessId: string): Promise<AutomationMode> {
  const { data, error } = await supabase
    .from("business_settings")
    .select("setting_value")
    .eq("business_id", businessId)
    .eq("setting_key", "automation_mode")
    .maybeSingle();
  if (error) throw new Error(`Failed to read automation_mode for business ${businessId}: ${error.message}`);
  return (data?.setting_value as AutomationMode | undefined) ?? "rules_only";
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`AI call timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Layer 2 (classification) -> Layer 4 (decideAction) escalation. Only ever entered for
 * automation_mode='smart', and only after Layer 1 already failed to confidently match -- see
 * runAutomationPipeline's own call site.
 *
 * Provider selection AND the classification call are both inside the same try/catch (audit
 * finding #1): a prior version called getAIProvider() outside it, so an unsupported/
 * unavailable provider configuration threw synchronously and crashed webhook processing
 * entirely instead of degrading to NEEDS_ATTENTION/ai_unavailable. Either failure now
 * degrades identically.
 *
 * ai_provider metadata is recorded even when the provider could not be constructed at all
 * (audit finding #1's provider-metadata clarification): getConfiguredProviderName() reports
 * which provider WAS configured, independent of whether building it succeeded, so
 * automation_decision_log always shows what was attempted, never a blank field standing in
 * for "we don't know."
 *
 * mode is always "smart" here by construction, so decideAction() can never return
 * SUGGEST_REPLY from this call site -- SUGGEST_REPLY has no producer or consumer anywhere in
 * this phase (ADR-0035's carry-forward prerequisite #1, still deferred). decideAction()'s own
 * input-validation throws (audit finding #7) are deliberately NOT caught here: those
 * represent a programming contract violation, not an AI failure, and should propagate to the
 * webhook route's failure/recovery path exactly like any other bug -- which is now safe to do
 * without losing the message (audit finding #2).
 */
async function escalateToAiLayer(
  supabase: Client,
  businessId: string,
  contactId: string,
  normalized: NormalizedInboundMessage,
  messageId: string,
  rules: Array<{ id: string; trigger_keywords: string[]; trigger_priority: number; reply_text: string }>,
  layer1Result: { outcome: "no_match" } | { outcome: "ambiguous"; tiedRules: MatchableRule[] },
  business: { vertical: string; preferred_language: string },
): Promise<void> {
  const candidateRules: MatchableRule[] = rules.map((r) => ({
    id: r.id,
    triggerKeywords: r.trigger_keywords,
    triggerPriority: r.trigger_priority,
  }));

  let classification: ClassificationResult | null = null;
  let fallbackReason: string | null = null;
  let aiProviderName: string | null = null;

  try {
    const provider = getAIProvider("classification");
    aiProviderName = provider.name;
    const raw = await withTimeout(
      provider.classifyMessage({
        content: normalized.content!,
        candidateRules,
        businessContext: { vertical: business.vertical, preferredLanguage: business.preferred_language },
      }),
      AI_CALL_TIMEOUT_MS,
    );
    classification = raw ? enforceCandidateRuleBoundary(raw, candidateRules) : null;
    if (!classification) fallbackReason = "malformed_response";
  } catch (error) {
    classification = null;
    aiProviderName = aiProviderName ?? getConfiguredProviderName("classification");
    if (error instanceof AIProviderUnavailableError) {
      fallbackReason = "provider_unavailable";
    } else if (error instanceof Error && error.message.includes("timed out")) {
      fallbackReason = "timeout";
    } else {
      fallbackReason = "provider_error";
    }
  }

  const decision = decideAction({
    mode: "smart",
    layer1Result,
    classification,
    thresholds: DEFAULT_DECISION_THRESHOLDS,
  });

  await recordAutomationDecision(supabase, {
    messageId,
    businessId,
    decisionSource: "layer4_decision",
    matchedRuleId: decision.kind === "AUTOMATE_REPLY" ? decision.ruleId : null,
    classification,
    aiProvider: aiProviderName,
    action: decision.kind,
    fallbackReason,
    escalationReason: decision.kind === "NEEDS_ATTENTION" ? decision.reason : null,
  });

  if (decision.kind === "AUTOMATE_REPLY") {
    const rule = rules.find((r) => r.id === decision.ruleId);
    // decideAction() only returns AUTOMATE_REPLY with a ruleId that survived
    // enforceCandidateRuleBoundary() above, i.e. one drawn from `rules` -- this lookup
    // cannot miss under correct operation. If it somehow did, fail safe rather than send
    // with fabricated content: never auto-reply without a concrete, real rule in hand.
    if (!rule) {
      await insertAttentionItem(supabase, businessId, contactId, "ai_low_confidence", "message", messageId);
      return;
    }
    await sendAutoReply(supabase, businessId, contactId, normalized, messageId, rule.id, rule.reply_text);
    return;
  }

  if (decision.kind === "SUGGEST_REPLY") {
    // Provably unreachable under mode: "smart" (decideAction() only returns SUGGEST_REPLY for
    // 'ai_assisted'/'advanced_ai', and this function is never called for those modes -- see
    // its own doc comment). Handled anyway, defensively, rather than trusting that
    // invariant to hold forever: fail safe into Needs Attention, never silently drop the
    // message, and never treat an unexpected decision shape as license to auto-reply.
    await insertAttentionItem(supabase, businessId, contactId, "ai_low_confidence", "message", messageId);
    return;
  }

  // decision.kind === "NEEDS_ATTENTION"
  await insertAttentionItem(supabase, businessId, contactId, decision.reason, "message", messageId);
}

/**
 * Everything after the inbound message row exists (fresh or resumed -- see
 * processInboundMessage). Returning normally from this function, by ANY of its branches, is
 * exactly what "this message's automation processing completed" means; processInboundMessage
 * marks messages.automation_processed_at immediately afterward. Throwing means processing did
 * NOT complete and must be resumed from here again on retry, never silently skipped.
 */
async function runAutomationPipeline(
  supabase: Client,
  businessId: string,
  contact: ResolvedContact,
  normalized: NormalizedInboundMessage,
  messageId: string,
): Promise<void> {
  // V1 explicitly ignores media content -- log metadata (already done at storage time), route
  // to Needs Owner Attention, never attempt to process or auto-reply based on it
  // (Ordrfy-Final-Architecture.pdf Section 12).
  if (normalized.mediaUrl) {
    await insertAttentionItem(supabase, businessId, contact.contactId, "media_message", "message", messageId);
    return;
  }

  if (!normalized.content) return; // nothing to match against

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("vertical, preferred_language, automation_paused, subscription_status, trial_ends_at")
    .eq("id", businessId)
    .single();
  if (businessError) throw new Error(`Business lookup failed: ${businessError.message}`);

  // Opt-out detection always wins over everything else (India-fit addendum #11) --
  // business-specific keywords first, falling back to global defaults, in the business's
  // preferred language.
  const { data: optOutKeywords } = await supabase
    .from("opt_out_keywords")
    .select("keyword")
    .or(`business_id.eq.${businessId},business_id.is.null`)
    .eq("language", business.preferred_language)
    .eq("active", true);

  if (matchesOptOutKeyword(normalized.content, optOutKeywords ?? [])) {
    await supabase
      .from("contact_channel_identities")
      .update({ opted_out_at: new Date().toISOString() })
      .eq("id", contact.identityId);
    await logActivity(supabase, businessId, contact.contactId, "opted_out", { channel: normalized.channel });
    return;
  }

  // Kill switch: suppresses ALL outbound automation, not just reminders -- while paused,
  // every inbound message is left for the owner rather than risking an automated send
  // (Non-Negotiable Architecture Rule 7).
  if (business.automation_paused) {
    await logActivity(supabase, businessId, contact.contactId, "automation_skipped_kill_switch");
    return;
  }

  // Trial-expiry graceful degradation applies to outbound automation generally, not just
  // reminders (docs/architecture/decisions/0013-trial-expiry-separate-from-kill-switch.md) -- a separate
  // computed condition from automation_paused, never that same flag.
  const { data: settingsRow } = await supabase
    .from("business_settings")
    .select("setting_value")
    .eq("business_id", businessId)
    .eq("setting_key", "trial_grace_period_days")
    .maybeSingle();
  const gracePeriodDays = settingsRow ? Number(settingsRow.setting_value) : DEFAULT_TRIAL_GRACE_PERIOD_DAYS;

  const billingEligible = isAutomationEligibleForBilling({
    subscriptionStatus: business.subscription_status as SubscriptionStatus,
    trialEndsAt: business.trial_ends_at,
    gracePeriodDays,
  });
  if (!billingEligible) {
    await logActivity(supabase, businessId, contact.contactId, "automation_skipped_trial_expired");
    return;
  }

  const mode = await getAutomationMode(supabase, businessId);

  // Audit finding #6: 'ai_assisted'/'advanced_ai' have no implementation in this phase and
  // fall through to the same code path as 'rules_only' below -- but doing so SILENTLY would
  // mean a business explicitly configured for one of those modes has no way to tell its
  // setting isn't actually being honored yet. Logged every time, mirroring how
  // automation_skipped_kill_switch/automation_skipped_trial_expired already log every skip,
  // rather than treated as an unremarkable default.
  if (mode === "ai_assisted" || mode === "advanced_ai") {
    await logActivity(supabase, businessId, contact.contactId, "automation_mode_not_yet_supported", {
      configured_mode: mode,
    });
  }

  const { data: rules } = await supabase
    .from("internal_reply_rules")
    .select("id, trigger_keywords, trigger_priority, reply_text, business_id")
    .or(`business_id.eq.${businessId},business_id.is.null`)
    .eq("vertical", business.vertical)
    .eq("language", business.preferred_language)
    .eq("active", true);

  // Business-specific rules override vertical defaults for the same rule_key -- since both
  // could match the same message, prefer business-specific rows when a vertical-default row
  // for the identical rule exists alongside it. Simplification for V1: dedupe isn't needed
  // yet since seed.sql only seeds vertical defaults; kept as a documented assumption.
  const candidates = (rules ?? []).map((r) => ({
    id: r.id,
    triggerKeywords: r.trigger_keywords,
    triggerPriority: r.trigger_priority,
  }));

  const matchResult = matchKeywordRule(normalized.content, candidates);

  if (matchResult.outcome === "matched") {
    const rule = (rules ?? []).find((r) => r.id === matchResult.rule.id)!;
    // Layer 4 never runs when Layer 1 already found a confident match -- audited here only
    // for automation_mode='smart' businesses, so a rules_only business (every business
    // today) triggers zero new writes, not just an unchanged customer-visible outcome.
    if (mode === "smart") {
      await recordAutomationDecision(supabase, {
        messageId,
        businessId,
        decisionSource: "layer1_rules",
        matchedRuleId: rule.id,
        classification: null,
        aiProvider: null,
        action: "AUTOMATE_REPLY",
        fallbackReason: null,
        escalationReason: null,
      });
    }
    await sendAutoReply(supabase, businessId, contact.contactId, normalized, messageId, rule.id, rule.reply_text);
    return;
  }

  // Layer 1 did not confidently match. Escalate to Layer 2/4 only for
  // automation_mode='smart' -- 'rules_only' and the not-yet-implemented
  // 'ai_assisted'/'advanced_ai' (see the logging above) both fall through to today's exact
  // behavior, unchanged (docs/architecture/decisions/0036-phase2-ai-classification-wiring.md).
  if (mode === "smart") {
    await escalateToAiLayer(supabase, businessId, contact.contactId, normalized, messageId, rules ?? [], matchResult, business);
    return;
  }

  if (matchResult.outcome === "no_match") {
    await insertAttentionItem(supabase, businessId, contact.contactId, "unmatched_message", "message", messageId);
    return;
  }
  await insertAttentionItem(supabase, businessId, contact.contactId, "ambiguous_match", "message", messageId);
}

/**
 * Atomically claims messageId for automation processing (audit finding #2): succeeds only if
 * the message has never been processed AND either was never claimed or its claim has gone
 * stale. This is the same "UPDATE ... WHERE ... RETURNING" compare-and-swap pattern already
 * used by claim_next_reminder()/claim_stuck_webhook_event(), for exactly the same reason --
 * a plain SELECT-then-decide-then-act sequence (what this replaces) has a race window
 * between two concurrent callers (a live webhook retry-delivery racing a recovery job tick,
 * or two overlapping recovery ticks) that could both observe "not yet processed" and both
 * proceed to run the pipeline. Returns true iff THIS call won the claim; a losing caller does
 * nothing further -- either the message just finished, or another attempt already holds a
 * live claim and will finish it, or that claim is not yet stale enough to reclaim (a future
 * recovery tick will retry once it is).
 */
async function claimMessageForProcessing(supabase: Client, messageId: string): Promise<boolean> {
  const staleThreshold = new Date(Date.now() - MESSAGE_CLAIM_STALE_MS).toISOString();
  const { data, error } = await supabase
    .from("messages")
    .update({ automation_claimed_at: new Date().toISOString() })
    .eq("id", messageId)
    .is("automation_processed_at", null)
    .or(`automation_claimed_at.is.null,automation_claimed_at.lt.${staleThreshold}`)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Failed to claim message ${messageId} for processing: ${error.message}`);
  return data !== null;
}

/**
 * Audit finding #5: this update completing is the ONLY thing that makes a message
 * non-resumable -- if it silently failed while the caller proceeded as though webhook
 * processing succeeded, the webhook_events row would be marked 'processed' (removing it from
 * recovery's view entirely) while the message itself stayed forever claimable-but-never-
 * reclaimed, since nothing would ever revisit a webhook event already marked done. Throwing
 * here instead means the webhook route's outer catch marks the event 'failed' -- genuinely
 * retryable -- rather than silently reporting success over a message stuck in limbo.
 */
async function markMessageAutomationProcessed(supabase: Client, messageId: string): Promise<void> {
  const { data, error } = await supabase
    .from("messages")
    .update({ automation_processed_at: new Date().toISOString() })
    .eq("id", messageId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Failed to mark message ${messageId} as automation-processed: ${error.message}`);
  if (!data) throw new Error(`Failed to mark message ${messageId} as automation-processed: no matching row found`);
}

/**
 * The full inbound flow: Customer Message -> Contact Resolution -> Automation Decision ->
 * Needs Owner Attention or Automated Action (CLAUDE.md's Core Flow). Called by the webhook
 * routes AFTER the durable-store-before-ack write, per the webhook durability pattern --
 * this function is the "then process" step, not the storage step.
 *
 * Audit finding #2, the reason for this function's shape: a `(provider, provider_message_id)`
 * duplicate used to be treated as unconditional proof "this message was already fully
 * processed," so any retry (specifically, webhook recovery reprocessing a row that failed
 * AFTER the message was durably stored -- an audit-write failure, any later exception) hit
 * the duplicate-insert branch and silently returned without ever completing what failed the
 * first time. Combined with claim_stuck_webhook_event() never having reclaimed 'failed' rows
 * at all (fixed separately, in the same change, at the database level), this made any
 * post-storage failure permanently unrecoverable -- a real, confirmed message-loss bug, not
 * merely a cosmetic one. messages.automation_processed_at is the resumability signal; a
 * duplicate insert now means "resume processing on the existing row" unless that row is
 * already marked processed (a harmless webhook re-delivery, correctly a no-op, unchanged).
 *
 * A second, independent audit found the resume path itself was not safe under true
 * concurrency: two callers could both observe automation_processed_at IS NULL and both
 * proceed to reprocess. claimMessageForProcessing() closes that with a single atomic
 * UPDATE ... WHERE ... RETURNING -- the fresh-insert path establishes its own claim as part
 * of the same INSERT (uncontested by construction, since nothing else can know about a row
 * that didn't exist a moment ago); the resume path must win the same atomic claim explicitly
 * before ever calling runAutomationPipeline.
 */
export async function processInboundMessage(
  supabase: Client,
  businessId: string,
  normalized: NormalizedInboundMessage,
): Promise<void> {
  const contact = await resolveOrCreateContact(supabase, businessId, normalized.channel, normalized.providerUserId, {
    phoneNumber: normalized.phoneNumber,
    displayHandle: normalized.displayHandle,
    displayName: normalized.displayName,
  });

  const { data: channelRow } = await supabase
    .from("channels")
    .select("id")
    .eq("name", normalized.channel)
    .single();

  const provider = normalized.channel === "whatsapp" ? "mock-whatsapp" : "mock-instagram";
  const now = new Date().toISOString();

  const { data: inboundMessage, error: insertError } = await supabase
    .from("messages")
    .insert({
      contact_id: contact.contactId,
      business_id: businessId,
      channel_id: channelRow!.id,
      direction: "inbound",
      message_type: normalized.messageType,
      content: normalized.content,
      media_url: normalized.mediaUrl,
      media_mime_type: normalized.mediaMimeType,
      provider_media_id: normalized.providerMediaId,
      provider,
      provider_message_id: normalized.providerMessageId,
      automation_claimed_at: now, // fresh row, uncontested claim established atomically by this same insert
    })
    .select("id, automation_processed_at")
    .single();

  let messageId: string;

  if (insertError) {
    if (insertError.code !== "23505") {
      throw new Error(`Failed to store inbound message: ${insertError.message}`);
    }
    const { data: existing, error: lookupError } = await supabase
      .from("messages")
      .select("id, automation_processed_at")
      .eq("provider", provider)
      .eq("provider_message_id", normalized.providerMessageId)
      .single();
    if (lookupError) throw new Error(`Failed to look up existing inbound message: ${lookupError.message}`);
    if (existing.automation_processed_at) return; // genuinely already finished -- true no-op

    const claimed = await claimMessageForProcessing(supabase, existing.id);
    if (!claimed) return; // lost the race: another attempt holds a live claim, or just finished
    messageId = existing.id; // resume processing on the existing row, do not re-insert
  } else {
    messageId = inboundMessage.id;
  }

  await runAutomationPipeline(supabase, businessId, contact, normalized, messageId);
  await markMessageAutomationProcessed(supabase, messageId);
}

async function sendAutoReply(
  supabase: Client,
  businessId: string,
  contactId: string,
  normalized: NormalizedInboundMessage,
  inboundMessageId: string,
  matchedRuleId: string,
  replyText: string,
): Promise<void> {
  const { data: channelRow } = await supabase
    .from("channels")
    .select("id")
    .eq("name", normalized.channel)
    .single();

  // Idempotency key derived BEFORE the send attempt, from (inbound_message_id,
  // matched_rule_id) -- same key no matter how many times this exact scenario retries
  // (Ordrfy-Final-Architecture.pdf Section 8).
  const idempotencyKey = `${inboundMessageId}:${matchedRuleId}`;

  const { data: existing } = await supabase
    .from("messages")
    .select("id, send_status")
    .eq("outbound_idempotency_key", idempotencyKey)
    .maybeSingle();

  // Pre-Phase 7 correctness remediation (Finding 2): a row already at send_status='sent' is
  // a true no-op -- never re-send. A row still at 'pending_send' means an earlier attempt
  // was interrupted before confirming success (the provider call itself threw, or the
  // process crashed) -- that must be retried, not treated as proof the reply already went
  // out. The prior version returned early for either status, so any provider failure
  // silently and permanently suppressed the reply: webhook recovery would reprocess the
  // inbound message, reach this exact idempotency key again, see the existing row, and stop
  // -- without ever calling the provider a second time. Retrying via the SAME row (never a
  // second insert) keeps exactly one messages row per idempotency key, so duplicate-send
  // prevention is unchanged; safety against two concurrent retries is provided one layer up,
  // by claimMessageForProcessing()'s atomic claim and claim_stuck_webhook_event()'s
  // FOR UPDATE SKIP LOCKED, both already in place before this function is ever re-entered.
  if (existing?.send_status === "sent") return;

  let outboundRowId: string;
  if (existing) {
    outboundRowId = existing.id;
  } else {
    const { data: pendingRow, error: pendingError } = await supabase
      .from("messages")
      .insert({
        contact_id: contactId,
        business_id: businessId,
        channel_id: channelRow!.id,
        direction: "outbound",
        content: replyText,
        is_auto_reply: true,
        provider: normalized.channel === "whatsapp" ? "mock-whatsapp" : "mock-instagram",
        outbound_idempotency_key: idempotencyKey,
        send_status: "pending_send",
      })
      .select("id")
      .single();
    if (pendingError) throw new Error(`Failed to record pending auto-reply: ${pendingError.message}`);
    outboundRowId = pendingRow.id;
  }

  const channelProvider = getChannelProvider(normalized.channel);
  const providerMessageId = await channelProvider.sendMessage(normalized.providerUserId, { text: replyText });

  await supabase
    .from("messages")
    .update({ send_status: "sent", provider_message_id: providerMessageId })
    .eq("id", outboundRowId);

  await logActivity(supabase, businessId, contactId, "auto_reply_sent", { rule_id: matchedRuleId });
}
