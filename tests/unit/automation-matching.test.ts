import { describe, it, expect } from "vitest";
import { matchKeywordRule, matchesOptOutKeyword, type MatchableRule } from "@/lib/engine/automation-matching";

describe("matchKeywordRule", () => {
  const priceRule: MatchableRule = { id: "price", triggerKeywords: ["price", "cost"], triggerPriority: 10 };
  const deliveryRule: MatchableRule = { id: "delivery", triggerKeywords: ["delivery", "shipping"], triggerPriority: 8 };

  it("matches a single rule case-insensitively", () => {
    const result = matchKeywordRule("What is the PRICE?", [priceRule, deliveryRule]);
    expect(result).toEqual({ outcome: "matched", rule: priceRule });
  });

  it("returns no_match when nothing matches", () => {
    const result = matchKeywordRule("Do you have this in red?", [priceRule, deliveryRule]);
    expect(result).toEqual({ outcome: "no_match" });
  });

  it("picks the higher-priority rule when a message matches more than one", () => {
    const result = matchKeywordRule("What's the price and delivery time?", [priceRule, deliveryRule]);
    expect(result).toEqual({ outcome: "matched", rule: priceRule });
  });

  it("falls through to ambiguous, never guesses, when two matching rules tie on priority", () => {
    const tiedA: MatchableRule = { id: "a", triggerKeywords: ["price"], triggerPriority: 10 };
    const tiedB: MatchableRule = { id: "b", triggerKeywords: ["cost"], triggerPriority: 10 };
    const result = matchKeywordRule("what's the price, is that the full cost?", [tiedA, tiedB]);
    expect(result.outcome).toBe("ambiguous");
    if (result.outcome === "ambiguous") {
      expect(result.tiedRules.map((r) => r.id).sort()).toEqual(["a", "b"]);
    }
  });

  it("returns no_match against an empty rule set", () => {
    expect(matchKeywordRule("hello", [])).toEqual({ outcome: "no_match" });
  });
});

describe("matchesOptOutKeyword", () => {
  it("matches case-insensitively as a substring", () => {
    expect(matchesOptOutKeyword("please STOP messaging me", [{ keyword: "stop" }])).toBe(true);
  });

  it("does not match when no keyword is present", () => {
    expect(matchesOptOutKeyword("what's the price?", [{ keyword: "stop" }, { keyword: "unsubscribe" }])).toBe(false);
  });

  it("returns false against an empty keyword list", () => {
    expect(matchesOptOutKeyword("stop", [])).toBe(false);
  });
});
