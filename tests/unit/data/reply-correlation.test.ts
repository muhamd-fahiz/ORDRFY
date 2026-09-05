import { describe, expect, it } from "vitest";
import { findCorrelatedReply } from "@/lib/data/reply-correlation";

describe("findCorrelatedReply", () => {
  it("returns the reply whose idempotency key is prefixed by the exact inbound message id", () => {
    const result = findCorrelatedReply("msg-1", [
      { content: "Here's the size chart.", outboundIdempotencyKey: "msg-1:rule-42", sendStatus: "sent" },
    ]);
    expect(result).toBe("Here's the size chart.");
  });

  it("returns null when no reply correlates to this inbound message", () => {
    const result = findCorrelatedReply("msg-1", [
      { content: "Unrelated reply.", outboundIdempotencyKey: "msg-2:rule-42", sendStatus: "sent" },
    ]);
    expect(result).toBeNull();
  });

  it("returns null for an empty reply list", () => {
    expect(findCorrelatedReply("msg-1", [])).toBeNull();
  });

  it("returns null when a reply has no idempotency key at all", () => {
    expect(findCorrelatedReply("msg-1", [{ content: "Stray reply.", outboundIdempotencyKey: null, sendStatus: "sent" }])).toBeNull();
  });

  it("never matches a message id that is merely a substring of another, unrelated id", () => {
    // "msg-1" must not accidentally match a key belonging to "msg-10" -- the ':' delimiter in
    // the prefix check is what prevents this, not luck.
    const result = findCorrelatedReply("msg-1", [
      { content: "Reply to a different message.", outboundIdempotencyKey: "msg-10:rule-1", sendStatus: "sent" },
    ]);
    expect(result).toBeNull();
  });

  it("picks the correct reply out of several replies for the same contact", () => {
    const replies = [
      { content: "Reply to the first message.", outboundIdempotencyKey: "msg-1:rule-1", sendStatus: "sent" },
      { content: "Reply to the second message.", outboundIdempotencyKey: "msg-2:rule-7", sendStatus: "sent" },
    ];
    expect(findCorrelatedReply("msg-2", replies)).toBe("Reply to the second message.");
    expect(findCorrelatedReply("msg-1", replies)).toBe("Reply to the first message.");
  });

  // Pre-Phase 7 correctness remediation, Finding 2: a reply stuck at send_status='pending_send'
  // (a provider failure that was never actually retried, prior to this fix) must never be
  // reported as a genuine reply -- even when its idempotency key correlates perfectly.
  describe("send status filtering (Finding 2 regression)", () => {
    it("never returns a reply still at send_status='pending_send'", () => {
      const result = findCorrelatedReply("msg-1", [
        { content: "Stuck, never actually sent.", outboundIdempotencyKey: "msg-1:rule-42", sendStatus: "pending_send" },
      ]);
      expect(result).toBeNull();
    });

    it("skips a pending_send row and still finds a genuinely sent one for a different message", () => {
      const replies = [
        { content: "Stuck reply to message 1.", outboundIdempotencyKey: "msg-1:rule-1", sendStatus: "pending_send" },
        { content: "Confirmed reply to message 2.", outboundIdempotencyKey: "msg-2:rule-2", sendStatus: "sent" },
      ];
      expect(findCorrelatedReply("msg-1", replies)).toBeNull();
      expect(findCorrelatedReply("msg-2", replies)).toBe("Confirmed reply to message 2.");
    });

    it("treats any non-'sent' status as not a genuine reply, not just 'pending_send' specifically", () => {
      const result = findCorrelatedReply("msg-1", [
        { content: "Some other status.", outboundIdempotencyKey: "msg-1:rule-42", sendStatus: "failed" },
      ]);
      expect(result).toBeNull();
    });
  });
});
