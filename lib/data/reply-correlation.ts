/**
 * "Make Automation Visible" phase. Correlates a specific inbound message to the exact
 * automatic reply it produced, if any -- reusing sendAutoReply()'s own
 * outbound_idempotency_key format (`${inboundMessageId}:${matchedRuleId}`, the only writer
 * of that column in the whole codebase, lib/engine/automation.ts) rather than any
 * time-based "most recent outbound message" heuristic. A prefix match against that exact
 * key is precise even when a contact has sent several messages since -- unlike "most
 * recent," it can never attribute a reply to the wrong message.
 *
 * Callers are responsible for only ever passing rows already filtered to
 * direction='outbound' AND is_auto_reply=true (both today.ts and contacts-list.ts do this
 * in their own query) -- is_auto_reply is set nowhere else in the codebase, so this
 * function's output can never represent a manual owner reply, a reminder send, or any other
 * outbound message, only a genuine automated one.
 */
export interface CorrelatableReply {
  content: string | null;
  outboundIdempotencyKey: string | null;
}

export function findCorrelatedReply(inboundMessageId: string, replies: CorrelatableReply[]): string | null {
  const prefix = `${inboundMessageId}:`;
  const match = replies.find((r) => r.outboundIdempotencyKey?.startsWith(prefix));
  return match?.content ?? null;
}
