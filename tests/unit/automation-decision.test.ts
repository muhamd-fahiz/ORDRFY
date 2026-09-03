import { describe, it, expect } from "vitest";
import {
  decideAction,
  DEFAULT_DECISION_THRESHOLDS,
  HUMAN_SUPPORT_REQUEST_INTENT,
  type ClassificationResult,
  type DecideActionInput,
} from "@/lib/engine/automation-decision";

describe("DEFAULT_DECISION_THRESHOLDS", () => {
  it("keeps high >= medium -- carry-forward prerequisite #2 (ADR-0035), enforced on the exported constant itself", () => {
    expect(DEFAULT_DECISION_THRESHOLDS.high).toBeGreaterThanOrEqual(DEFAULT_DECISION_THRESHOLDS.medium);
  });
});

const thresholds = { high: 0.85, medium: 0.6 };
const noMatch: DecideActionInput["layer1Result"] = { outcome: "no_match" };

function classification(overrides: Partial<ClassificationResult> = {}): ClassificationResult {
  return {
    language: "manglish",
    intent: "price_inquiry",
    confidence: 0.9,
    entities: {},
    matchedRuleId: "rule-price",
    ...overrides,
  };
}

describe("decideAction", () => {
  it("throws if called in rules_only mode -- callers must never reach this function then", () => {
    expect(() =>
      decideAction({ mode: "rules_only", layer1Result: noMatch, classification: classification(), thresholds }),
    ).toThrow(/rules_only/);
  });

  it("returns NEEDS_ATTENTION/ai_unavailable when classification is null", () => {
    const result = decideAction({ mode: "smart", layer1Result: noMatch, classification: null, thresholds });
    expect(result).toEqual({ kind: "NEEDS_ATTENTION", reason: "ai_unavailable" });
  });

  it("always escalates an explicit human-support-request intent, regardless of confidence", () => {
    const result = decideAction({
      mode: "smart",
      layer1Result: noMatch,
      classification: classification({ intent: HUMAN_SUPPORT_REQUEST_INTENT, confidence: 0.99 }),
      thresholds,
    });
    expect(result).toEqual({ kind: "NEEDS_ATTENTION", reason: "human_requested" });
  });

  it("automates a reply at or above the high threshold when a rule was matched", () => {
    const result = decideAction({
      mode: "smart",
      layer1Result: noMatch,
      classification: classification({ confidence: thresholds.high }),
      thresholds,
    });
    expect(result).toEqual({ kind: "AUTOMATE_REPLY", ruleId: "rule-price" });
  });

  it("never auto-replies at high confidence without a matched rule to reuse", () => {
    const result = decideAction({
      mode: "smart",
      layer1Result: noMatch,
      classification: classification({ confidence: 0.95, matchedRuleId: null }),
      thresholds,
    });
    expect(result).toEqual({ kind: "NEEDS_ATTENTION", reason: "ai_low_confidence" });
  });

  it("escalates a medium-confidence result to ambiguous_match in smart mode", () => {
    const result = decideAction({
      mode: "smart",
      layer1Result: noMatch,
      classification: classification({ confidence: thresholds.medium }),
      thresholds,
    });
    expect(result).toEqual({ kind: "NEEDS_ATTENTION", reason: "ambiguous_match" });
  });

  it.each(["ai_assisted", "advanced_ai"] as const)(
    "surfaces a medium-confidence result as SUGGEST_REPLY in %s mode when a rule was matched",
    (mode) => {
      const result = decideAction({
        mode,
        layer1Result: noMatch,
        classification: classification({ confidence: thresholds.medium }),
        thresholds,
      });
      expect(result).toEqual({ kind: "SUGGEST_REPLY", ruleId: "rule-price" });
    },
  );

  it("falls back to ai_low_confidence at medium confidence in ai_assisted mode with no matched rule", () => {
    const result = decideAction({
      mode: "ai_assisted",
      layer1Result: noMatch,
      classification: classification({ confidence: thresholds.medium, matchedRuleId: null }),
      thresholds,
    });
    expect(result).toEqual({ kind: "NEEDS_ATTENTION", reason: "ai_low_confidence" });
  });

  it("escalates a low-confidence result to ai_low_confidence regardless of mode", () => {
    const result = decideAction({
      mode: "smart",
      layer1Result: { outcome: "ambiguous", tiedRules: [] },
      classification: classification({ confidence: 0.1 }),
      thresholds,
    });
    expect(result).toEqual({ kind: "NEEDS_ATTENTION", reason: "ai_low_confidence" });
  });

  // Audit finding #7: runtime validation, not just upstream trust.
  it.each([1.5, -0.1, Number.NaN, Number.POSITIVE_INFINITY])(
    "throws on an out-of-range confidence value (%s)",
    (confidence) => {
      expect(() =>
        decideAction({ mode: "smart", layer1Result: noMatch, classification: classification({ confidence }), thresholds }),
      ).toThrow(/confidence/);
    },
  );

  it("throws when thresholds.high < thresholds.medium", () => {
    expect(() =>
      decideAction({
        mode: "smart",
        layer1Result: noMatch,
        classification: classification(),
        thresholds: { high: 0.4, medium: 0.6 },
      }),
    ).toThrow(/thresholds/);
  });

  it.each([
    { high: 1.5, medium: 0.5 },
    { high: 0.9, medium: -0.1 },
  ])("throws on an out-of-range threshold value (%j)", (badThresholds) => {
    expect(() =>
      decideAction({ mode: "smart", layer1Result: noMatch, classification: classification(), thresholds: badThresholds }),
    ).toThrow(/thresholds/);
  });
});
