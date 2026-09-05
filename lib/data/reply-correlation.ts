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
 *
 * Pre-Phase 7 correctness remediation (Finding 2): also requires sendStatus === "sent",
 * both here AND in each caller's own query (belt-and-suspenders, matching this codebase's
 * convention elsewhere -- RLS plus an explicit .eq() filter, a route's own guard plus a DB
 * trigger). Before this fix, sendAutoReply() could leave a row permanently at
 * send_status='pending_send' after a provider failure that was never actually retried; that
 * row must never render as "Ordrfy replied" when it was never actually sent.
 */
export interface CorrelatableReply {
  content: string | null;
  outboundIdempotencyKey: string | null;
  sendStatus: string | null;
}

export function findCorrelatedReply(inboundMessageId: string, replies: CorrelatableReply[]): string | null {
  const prefix = `${inboundMessageId}:`;
  const match = replies.find((r) => r.sendStatus === "sent" && r.outboundIdempotencyKey?.startsWith(prefix));
  return match?.content ?? null;
}
