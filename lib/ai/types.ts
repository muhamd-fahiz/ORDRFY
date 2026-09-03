/**
 * Shared AI-understanding abstraction (docs/architecture/decisions/0036-phase2-ai-classification-wiring.md).
 * Mirrors lib/channels/types.ts's own provider-abstraction shape deliberately: automation.ts
 * talks only to this interface, obtained only through lib/ai/factory.ts -- the same
 * discipline that already keeps the messaging-channel layer provider-independent
 * (Non-Negotiable Architecture Rule 6, extended here to AI providers).
 *
 * Only one capability exists today -- "classification" -- per the locked multi-model
 * architecture decision. There is no generateReply()/embedKnowledge() here: this phase does
 * not use, and this interface does not expose, any capability beyond classification. Adding
 * a capability is a separate, explicit architectural decision, never an incidental addition
 * to this file.
 */

import type { MatchableRule } from "@/lib/engine/automation-matching";
import type { ClassificationResult } from "@/lib/engine/automation-decision";

export type AICapability = "classification";

export interface ClassifyInput {
  content: string;
  /**
   * The exact bounded rule set the caller already fetched for Layer 1's own keyword
   * matching (business override union vertical default, filtered by vertical/language/
   * active) -- never a broader or re-fetched set. A provider's classifyMessage() may only
   * return a matchedRuleId drawn from this list, or null; the caller independently enforces
   * this boundary too (lib/ai/validation.ts's enforceCandidateRuleBoundary()), so a provider
   * bug or a hallucinated id can never reach a rule it wasn't given.
   */
  candidateRules: MatchableRule[];
  businessContext: { vertical: string; preferredLanguage: string };
}

export interface AIUnderstandingProvider {
  readonly name: string;
  readonly capability: AICapability;
  /**
   * A genuine provider failure (network error, timeout, rate limit) should reject/throw --
   * callers (lib/engine/automation.ts) catch this and treat it identically to a null
   * resolution. Resolving to null directly is for a call that completed but produced a
   * validated-but-unusable result. Either way, the caller's fallback is the same: pass
   * classification=null into decideAction(). matchedRuleId on a real result may itself be
   * null -- the AI is never forced to select a rule it isn't confident about (see
   * ClassificationResult's own doc comment in lib/engine/automation-decision.ts).
   */
  classifyMessage(input: ClassifyInput): Promise<ClassificationResult | null>;
}
