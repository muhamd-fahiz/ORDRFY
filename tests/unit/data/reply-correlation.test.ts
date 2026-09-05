import { describe, expect, it } from "vitest";
import { findCorrelatedReply } from "@/lib/data/reply-correlation";

describe("findCorrelatedReply", () => {
  it("returns the reply whose idempotency key is prefixed by the exact inbound message id", () => {
    const result = findCorrelatedReply("msg-1", [
      { content: "Here's the size chart.", outboundIdempotencyKey: "msg-1:rule-42" },
    ]);
    expect(result).toBe("Here's the size chart.");
  });

  it("returns null when no reply correlates to this inbound message", () => {
    const result = findCorrelatedReply("msg-1", [{ content: "Unrelated reply.", outboundIdempotencyKey: "msg-2:rule-42" }]);
    expect(result).toBeNull();
  });

  it("returns null for an empty reply list", () => {
    expect(findCorrelatedReply("msg-1", [])).toBeNull();
  });

  it("returns null when a reply has no idempotency key at all", () => {
    expect(findCorrelatedReply("msg-1", [{ content: "Stray reply.", outboundIdempotencyKey: null }])).toBeNull();
  });

  it("never matches a message id that is merely a substring of another, unrelated id", () => {
    // "msg-1" must not accidentally match a key belonging to "msg-10" -- the ':' delimiter in
    // the prefix check is what prevents this, not luck.
    const result = findCorrelatedReply("msg-1", [{ content: "Reply to a different message.", outboundIdempotencyKey: "msg-10:rule-1" }]);
    expect(result).toBeNull();
  });

  it("picks the correct reply out of several replies for the same contact", () => {
    const replies = [
      { content: "Reply to the first message.", outboundIdempotencyKey: "msg-1:rule-1" },
      { content: "Reply to the second message.", outboundIdempotencyKey: "msg-2:rule-7" },
    ];
    expect(findCorrelatedReply("msg-2", replies)).toBe("Reply to the second message.");
    expect(findCorrelatedReply("msg-1", replies)).toBe("Reply to the first message.");
  });
});
