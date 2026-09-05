/**
 * "Make Automation Visible" phase. Plain-language copy for owner_attention_queue.reason --
 * the column has been written on every insert since ADR-0006, but no owner-facing screen
 * ever displayed it; this is the one place that mapping lives.
 *
 * The 9 values below are the complete, authoritative set from the reason CHECK constraint
 * (supabase/migrations/20260828120023_owner_attention_queue.sql's original 5, expanded by
 * 20260903000002_ai_needs_attention_reasons.sql's 4 more) -- not a locally-invented list.
 * Five of these are live today (every business is automation_mode='rules_only'); the other
 * four (ai_low_confidence, human_requested, ai_unavailable, ai_suggested_needs_review) have
 * no current producer -- included anyway so a future 'smart' mode never surfaces a row with
 * no copy for it.
 */
export type AttentionReason =
  | "unmatched_message"
  | "ambiguous_match"
  | "media_message"
  | "reminder_channel_unsupported"
  | "manual_flag"
  | "ai_low_confidence"
  | "ai_suggested_needs_review"
  | "human_requested"
  | "ai_unavailable";

export const ATTENTION_REASON_COPY: Record<AttentionReason, string> = {
  unmatched_message: "Ordrfy couldn't match this message to an automatic reply.",
  ambiguous_match: "This message matched more than one automatic reply — Ordrfy wasn't sure which one to use.",
  media_message: "This customer sent a photo, video, or file, which Ordrfy can't read yet.",
  reminder_channel_unsupported: "A reminder couldn't be delivered to this customer on any available channel.",
  manual_flag: "A reminder to this customer failed to send after repeated attempts.",
  ai_low_confidence: "Ordrfy wasn't confident enough in its understanding to reply automatically.",
  ai_suggested_needs_review: "Ordrfy drafted a possible reply for your review.",
  human_requested: "This customer asked to speak with a person.",
  ai_unavailable: "Ordrfy's automatic understanding wasn't available for this message.",
};

/** Falls back to the raw reason string for a value this map somehow doesn't cover, rather
 *  than rendering nothing -- defensive only; every value the DB can produce is listed above. */
export function describeAttentionReason(reason: string): string {
  return ATTENTION_REASON_COPY[reason as AttentionReason] ?? reason;
}
