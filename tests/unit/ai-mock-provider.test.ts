import { describe, it, expect } from "vitest";
import { MockAIProvider } from "@/lib/ai/mock";
import type { MatchableRule } from "@/lib/engine/automation-matching";

const candidateRules: MatchableRule[] = [
  { id: "rule-price", triggerKeywords: ["price"], triggerPriority: 10 },
  { id: "rule-delivery", triggerKeywords: ["delivery"], triggerPriority: 8 },
];

const businessContext = { vertical: "fashion", preferredLanguage: "en" };

describe("MockAIProvider", () => {
  const provider = new MockAIProvider();

  it("defaults to a confident match against the first candidate rule", async () => {
    const result = await provider.classifyMessage({ content: "price entha?", candidateRules, businessContext });
    expect(result).toMatchObject({ confidence: 0.9, matchedRuleId: "rule-price" });
  });

  it("returns null matchedRuleId when no candidate rule fits, without being forced to guess", async () => {
    const result = await provider.classifyMessage({
      content: "SIMULATE_AI_NO_CONFIDENT_RULE",
      candidateRules,
      businessContext,
    });
    expect(result).toMatchObject({ matchedRuleId: null, confidence: 0.9 });
  });

  it("returns a low-confidence result on request", async () => {
    const result = await provider.classifyMessage({
      content: "SIMULATE_AI_LOW_CONFIDENCE",
      candidateRules,
      businessContext,
    });
    expect(result?.confidence).toBeLessThan(0.6);
  });

  it("returns a human-support-request intent on request", async () => {
    const result = await provider.classifyMessage({
      content: "SIMULATE_AI_HUMAN_REQUEST",
      candidateRules,
      businessContext,
    });
    expect(result?.intent).toBe("human_support_request");
  });

  it("nulls out a matchedRuleId the mock deliberately fabricates outside the candidate set", async () => {
    const result = await provider.classifyMessage({
      content: "SIMULATE_AI_UNKNOWN_RULE",
      candidateRules,
      businessContext,
    });
    expect(result?.matchedRuleId).toBeNull();
  });

  it("returns null for a malformed provider response instead of throwing", async () => {
    const result = await provider.classifyMessage({ content: "SIMULATE_AI_MALFORMED", candidateRules, businessContext });
    expect(result).toBeNull();
  });

  it("throws to represent a genuine provider failure", async () => {
    await expect(
      provider.classifyMessage({ content: "SIMULATE_AI_ERROR", candidateRules, businessContext }),
    ).rejects.toThrow();
  });

  it("returns a null matchedRuleId when there are no candidate rules at all", async () => {
    const result = await provider.classifyMessage({ content: "price?", candidateRules: [], businessContext });
    expect(result?.matchedRuleId).toBeNull();
  });
});
