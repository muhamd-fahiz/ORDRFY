/**
 * The single choke point every AIUnderstandingProvider's raw output passes through before
 * lib/engine/automation.ts ever sees it (docs/architecture/decisions/0036-phase2-ai-classification-wiring.md).
 * Two independent guarantees, kept as two functions rather than one, since they answer
 * different questions: parseClassificationResult asks "is this shaped like a valid
 * classification at all," enforceCandidateRuleBoundary asks "does its matchedRuleId actually
 * belong to the rule set we sent." Both apply identically regardless of which provider
 * produced the result -- the mock exercises the exact same gate a real provider's untrusted
 * JSON will later go through.
 */

import type { MatchableRule } from "@/lib/engine/automation-matching";
import type { ClassificationResult } from "@/lib/engine/automation-decision";

/**
 * Structural + range validation only. Returns null (never throws) on anything malformed --
 * a malformed response is treated identically to "AI unavailable" by the caller, not a
 * distinct failure mode. matchedRuleId is intentionally permitted to be null here: the AI is
 * never forced to select a rule (see ClassificationResult's own doc comment) -- only
 * enforceCandidateRuleBoundary() below validates a non-null value further.
 */
export function parseClassificationResult(raw: unknown): ClassificationResult | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const { language, intent, confidence, entities, matchedRuleId } = value;

  if (language !== null && typeof language !== "string") return null;
  if (intent !== null && typeof intent !== "string") return null;
  if (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
  if (matchedRuleId !== null && typeof matchedRuleId !== "string") return null;
  if (typeof entities !== "object" || entities === null || Array.isArray(entities)) return null;
  for (const v of Object.values(entities as Record<string, unknown>)) {
    if (typeof v !== "string") return null;
  }

  return {
    language: (language as string | null) ?? null,
    intent: (intent as string | null) ?? null,
    confidence,
    entities: entities as Record<string, string>,
    matchedRuleId: (matchedRuleId as string | null) ?? null,
  };
}

/**
 * Concrete enforcement of "AI must not invent new rules": if matchedRuleId doesn't correspond
 * to one of the exact candidateRules this call was scoped to, it is nulled out -- never
 * trusted, never passed through. This makes it structurally impossible for a provider (by
 * bug, by hallucination, or by a malicious response) to cause automation.ts to reuse a rule
 * that wasn't already an applicable, active, tenant-scoped rule for this business/vertical/
 * language. confidence, language, and intent are left untouched -- they may still be a useful
 * signal for the NEEDS_ATTENTION reason even when the specific rule reference is rejected.
 */
export function enforceCandidateRuleBoundary(
  result: ClassificationResult,
  candidateRules: MatchableRule[],
): ClassificationResult {
  if (result.matchedRuleId === null) return result;
  const isKnownCandidate = candidateRules.some((rule) => rule.id === result.matchedRuleId);
  return isKnownCandidate ? result : { ...result, matchedRuleId: null };
}
