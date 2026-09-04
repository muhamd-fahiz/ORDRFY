import type { VerticalKey } from "@/lib/design/verticals";
import type { VerticalDetectionResult } from "./detect-vertical";

/**
 * A provider-agnostic boundary for a possible future AI-assisted fallback (ADR-0041).
 *
 * DORMANT ON PURPOSE -- this file is a type only. There is no concrete implementation, no
 * factory, no environment-variable-driven provider selection, no AI SDK dependency, and
 * nothing anywhere in this codebase calls it. detect-vertical.ts is complete and correct
 * entirely on its own with this interface totally unused; this type exists only so that
 * IF a future phase is explicitly approved to implement real AI assistance, it has an
 * agreed-on shape to implement against rather than guessing one under time pressure.
 * Adding a real implementation, a factory, or any provider SDK is future-phase scope, not
 * this one -- see docs/architecture/decisions/0041-deterministic-onboarding-knowledge-engine.md.
 */
export interface BusinessUnderstandingProvider {
  /**
   * Given the raw business description and what the deterministic engine already
   * concluded, returns a single normalized vertical or null if the provider cannot help.
   * A real implementation must never invent a vertical not already among
   * deterministicResult.candidates unless it has independent, disclosed justification --
   * this interface does not decide that policy, a future implementation does. Must be
   * safe to call under a strict timeout and must never be the only path to a result: any
   * caller of a future implementation is responsible for falling back to
   * deterministicResult's own ambiguous/unmatched handling if this returns null, throws,
   * or times out.
   */
  classify(
    rawInput: string,
    deterministicResult: VerticalDetectionResult,
  ): Promise<BusinessUnderstandingResult | null>;
}

export interface BusinessUnderstandingResult {
  vertical: VerticalKey;
  /** Always "ai_assisted" -- keeps this result visually distinct from a deterministic "confident" match wherever it's displayed. */
  confidence: "ai_assisted";
}
