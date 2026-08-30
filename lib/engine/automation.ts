import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/database.types";
import type { NormalizedInboundMessage } from "@/lib/channels/types";
import { getChannelProvider } from "@/lib/channels/factory";
import { resolveOrCreateContact } from "./contact-resolution";
import { matchKeywordRule, matchesOptOutKeyword } from "./automation-matching";
import { isAutomationEligibleForBilling, type SubscriptionStatus } from "./trial-eligibility";

type Client = SupabaseClient<Database>;

const DEFAULT_TRIAL_GRACE_PERIOD_DAYS = 3;

async function insertAttentionItem(
  supabase: Client,
  businessId: string,
  contactId: string,
  reason: Database["public"]["Tables"]["owner_attention_queue"]["Row"]["reason"],
  referenceType: Database["public"]["Tables"]["owner_attention_queue"]["Row"]["reference_type"],
  referenceId?: string,
) {
  await supabase.from("owner_attention_queue").insert({
    business_id: businessId,
    contact_id: contactId,
    reason,
    reference_type: referenceType,
    reference_id: referenceId ?? null,
  });
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
 * The full inbound flow: Customer Message -> Contact Resolution -> Automation Decision ->
 * Needs Owner Attention or Automated Action (CLAUDE.md's Core Flow). Called by the webhook
 * routes AFTER the durable-store-before-ack write, per the webhook durability pattern --
 * this function is the "then process" step, not the storage step.
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
      provider: normalized.channel === "whatsapp" ? "mock-whatsapp" : "mock-instagram",
      provider_message_id: normalized.providerMessageId,
    })
    .select("id")
    .single();

  // Duplicate inbound message (same provider, provider_message_id) -- unique index
  // violation. Already processed once; do not reprocess (idempotency rule 5).
  if (insertError) {
    if (insertError.code === "23505") return;
    throw new Error(`Failed to store inbound message: ${insertError.message}`);
  }

  // V1 explicitly ignores media content -- log metadata (already done above), route to
  // Needs Owner Attention, never attempt to process or auto-reply based on it
  // (Ordrfy-Final-Architecture.pdf Section 12).
  if (normalized.mediaUrl) {
    await insertAttentionItem(supabase, businessId, contact.contactId, "media_message", "message", inboundMessage.id);
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

  if (matchResult.outcome === "no_match") {
    await insertAttentionItem(supabase, businessId, contact.contactId, "unmatched_message", "message", inboundMessage.id);
    return;
  }
  if (matchResult.outcome === "ambiguous") {
    await insertAttentionItem(supabase, businessId, contact.contactId, "ambiguous_match", "message", inboundMessage.id);
    return;
  }

  const rule = (rules ?? []).find((r) => r.id === matchResult.rule.id)!;
  await sendAutoReply(supabase, businessId, contact.contactId, normalized, inboundMessage.id, rule.id, rule.reply_text);
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
  if (existing) return; // already attempted (sent or pending_send) -- never double-send

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

  const provider = getChannelProvider(normalized.channel);
  const providerMessageId = await provider.sendMessage(normalized.providerUserId, { text: replyText });

  await supabase
    .from("messages")
    .update({ send_status: "sent", provider_message_id: providerMessageId })
    .eq("id", pendingRow.id);

  await logActivity(supabase, businessId, contactId, "auto_reply_sent", { rule_id: matchedRuleId });
}
