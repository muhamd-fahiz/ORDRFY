import type { AICapability, AIUnderstandingProvider, ClassifyInput } from "./types";
import type { ClassificationResult } from "@/lib/engine/automation-decision";
import { parseClassificationResult, enforceCandidateRuleBoundary } from "./validation";

/**
 * Deterministic, content-driven mock -- no real language understanding, the same
 * "manually-triggered test scenario" philosophy as MockWhatsAppProvider
 * (lib/channels/whatsapp/mock.ts): behavior is entirely a function of magic substrings in
 * the inbound message content, never hidden state, so a test or verification script can
 * exercise every branch of the Phase 2 fallback chain deterministically.
 *
 * Absent a magic marker, defaults to a confident match against the first candidate rule (if
 * any exist), so an ordinary Layer 1 no_match/ambiguous message gets a realistic
 * AUTOMATE_REPLY outcome to exercise without needing a marker for the common case.
 */
export class MockAIProvider implements AIUnderstandingProvider {
  readonly name = "mock";
  readonly capability: AICapability = "classification";

  async classifyMessage(input: ClassifyInput): Promise<ClassificationResult | null> {
    const content = input.content;

    if (content.includes("SIMULATE_AI_ERROR")) {
      // Represents a genuine provider failure (network error, rate limit) -- callers must
      // catch this, not just handle a null resolution.
      throw new Error("MockAIProvider: simulated provider error");
    }

    const raw = this.buildRawResult(content, input);
    const parsed = parseClassificationResult(raw);
    if (!parsed) return null;
    return enforceCandidateRuleBoundary(parsed, input.candidateRules);
  }

  private buildRawResult(content: string, input: ClassifyInput): unknown {
    if (content.includes("SIMULATE_AI_MALFORMED")) {
      // Deliberately invalid shape -- exercises parseClassificationResult's rejection path.
      return { confidence: "not-a-number" };
    }

    if (content.includes("SIMULATE_AI_UNKNOWN_RULE")) {
      // A rule id that was never part of candidateRules -- exercises
      // enforceCandidateRuleBoundary()'s rejection of an invented rule reference.
      return {
        language: "en",
        intent: "price_inquiry",
        confidence: 0.95,
        entities: {},
        matchedRuleId: "not-a-real-candidate-id",
      };
    }

    if (content.includes("SIMULATE_AI_LOW_CONFIDENCE")) {
      return {
        language: "manglish",
        intent: "price_inquiry",
        confidence: 0.2,
        entities: {},
        matchedRuleId: input.candidateRules[0]?.id ?? null,
      };
    }

    if (content.includes("SIMULATE_AI_NO_CONFIDENT_RULE")) {
      // High confidence about the intent, but no candidate rule genuinely fits --
      // matchedRuleId: null is a legitimate, expected result, never forced to a guess.
      return {
        language: "manglish",
        intent: "unrecognized_intent",
        confidence: 0.9,
        entities: {},
        matchedRuleId: null,
      };
    }

    if (content.includes("SIMULATE_AI_HUMAN_REQUEST")) {
      return {
        language: "en",
        intent: "human_support_request",
        confidence: 0.97,
        entities: {},
        matchedRuleId: null,
      };
    }

    return {
      language: "manglish",
      intent: "price_inquiry",
      confidence: 0.9,
      entities: {},
      matchedRuleId: input.candidateRules[0]?.id ?? null,
    };
  }
}
