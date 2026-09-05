import { describe, expect, it } from "vitest";
import { ATTENTION_REASON_COPY, describeAttentionReason, type AttentionReason } from "@/lib/design/attention-reasons";

/**
 * Mirrors the exact owner_attention_queue.reason CHECK constraint (the original 5 from
 * supabase/migrations/20260828120023_owner_attention_queue.sql, expanded by
 * 20260903000002_ai_needs_attention_reasons.sql's 4 more) as a local fixture, so this test
 * fails loudly if either file ever drifts from the other -- the same regression-guard
 * pattern already used for DEMO_SAMPLE_MESSAGES against seed.sql.
 */
const DB_REASON_VALUES: AttentionReason[] = [
  "unmatched_message",
  "ambiguous_match",
  "media_message",
  "reminder_channel_unsupported",
  "manual_flag",
  "ai_low_confidence",
  "ai_suggested_needs_review",
  "human_requested",
  "ai_unavailable",
];

describe("ATTENTION_REASON_COPY", () => {
  it("covers exactly the DB's reason values -- no more, no fewer", () => {
    expect(Object.keys(ATTENTION_REASON_COPY).sort()).toEqual([...DB_REASON_VALUES].sort());
  });

  it("gives every reason non-empty, distinct copy", () => {
    const values = Object.values(ATTENTION_REASON_COPY);
    for (const text of values) {
      expect(text.trim().length).toBeGreaterThan(0);
    }
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("describeAttentionReason", () => {
  it("returns the mapped copy for a known reason", () => {
    expect(describeAttentionReason("unmatched_message")).toBe(ATTENTION_REASON_COPY.unmatched_message);
  });

  it("falls back to the raw string for an unrecognized reason rather than rendering nothing", () => {
    expect(describeAttentionReason("some_future_reason")).toBe("some_future_reason");
  });
});
