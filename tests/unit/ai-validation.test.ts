import { describe, it, expect } from "vitest";
import { parseClassificationResult, enforceCandidateRuleBoundary } from "@/lib/ai/validation";
import type { MatchableRule } from "@/lib/engine/automation-matching";
import type { ClassificationResult } from "@/lib/engine/automation-decision";

const validRaw = {
  language: "manglish",
  intent: "price_inquiry",
  confidence: 0.9,
  entities: {},
  matchedRuleId: "rule-1",
};

describe("parseClassificationResult", () => {
  it("accepts a well-formed classification", () => {
    expect(parseClassificationResult(validRaw)).toEqual(validRaw);
  });

  it("accepts a null language, intent, and matchedRuleId -- the AI is never forced to guess", () => {
    const raw = { ...validRaw, language: null, intent: null, matchedRuleId: null };
    expect(parseClassificationResult(raw)).toEqual(raw);
  });

  it("rejects a non-numeric confidence", () => {
    expect(parseClassificationResult({ ...validRaw, confidence: "high" })).toBeNull();
  });

  it("rejects a confidence outside the 0..1 range", () => {
    expect(parseClassificationResult({ ...validRaw, confidence: 1.5 })).toBeNull();
    expect(parseClassificationResult({ ...validRaw, confidence: -0.1 })).toBeNull();
  });

  it("rejects a non-object entities value", () => {
    expect(parseClassificationResult({ ...validRaw, entities: "none" })).toBeNull();
  });

  it("rejects entities with a non-string value", () => {
    expect(parseClassificationResult({ ...validRaw, entities: { product: 5 } })).toBeNull();
  });

  it("rejects null, an array, and a primitive", () => {
    expect(parseClassificationResult(null)).toBeNull();
    expect(parseClassificationResult([validRaw])).toBeNull();
    expect(parseClassificationResult("not an object")).toBeNull();
  });
});

describe("enforceCandidateRuleBoundary", () => {
  const candidates: MatchableRule[] = [
    { id: "rule-1", triggerKeywords: ["price"], triggerPriority: 10 },
    { id: "rule-2", triggerKeywords: ["delivery"], triggerPriority: 8 },
  ];

  function result(overrides: Partial<ClassificationResult> = {}): ClassificationResult {
    return { language: "en", intent: "price_inquiry", confidence: 0.9, entities: {}, matchedRuleId: "rule-1", ...overrides };
  }

  it("passes through a matchedRuleId that is a genuine candidate", () => {
    expect(enforceCandidateRuleBoundary(result(), candidates)).toEqual(result());
  });

  it("passes through a null matchedRuleId unchanged", () => {
    expect(enforceCandidateRuleBoundary(result({ matchedRuleId: null }), candidates)).toEqual(
      result({ matchedRuleId: null }),
    );
  });

  it("nulls out a matchedRuleId that was never one of the candidates -- AI must not invent rules", () => {
    const invented = result({ matchedRuleId: "not-a-real-candidate-id" });
    expect(enforceCandidateRuleBoundary(invented, candidates)).toEqual(result({ matchedRuleId: null }));
  });

  it("nulls out a matchedRuleId against an empty candidate set", () => {
    expect(enforceCandidateRuleBoundary(result(), [])).toEqual(result({ matchedRuleId: null }));
  });
});
