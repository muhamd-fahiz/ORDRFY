/**
 * Layer 4 -- the deterministic decision authority
 * (docs/architecture/decisions/0035-layered-ai-automation-phase1.md). Consumes Layer 1's own
 * result (already run and already NOT confident) plus an optional Layer 2 classification,
 * and returns a structured action. Never calls an AI provider itself -- classification is
 * always supplied by the caller, already computed (or null when unavailable). This function
 * is the entire "AI recommends, application controls" boundary: nothing downstream of its
 * return value is allowed to originate from a model's own opinion of what should happen next.
 *
 * WIRED IN as of Phase 2 (docs/architecture/decisions/0036-phase2-ai-classification-wiring.md):
 * lib/engine/automation.ts's escalateToAiLayer() calls this, but only when
 * automation_mode='smart' and Layer 1 already failed to confidently match --
 * automation-matching.ts and every webhook/reminder file remain otherwise unchanged.
 * 'ai_assisted'/'advanced_ai' never reach this function at all (they fall through to the
 * same rules_only-equivalent path), so a SUGGEST_REPLY result, while representable in
 * DecisionAction below, has no live producer or consumer anywhere in the codebase yet --
 * ADR-0035's carry-forward prerequisite #1, still deferred.
 */

import type { MatchableRule } from "./automation-matching";

export type AutomationMode = "rules_only" | "smart" | "ai_assisted" | "advanced_ai";

/**
 * Canonical vocabulary shared across DecisionAction, owner_attention_queue.reason (see
 * supabase/migrations/20260903000002_ai_needs_attention_reasons.sql), and
 * automation_decision_log.escalation_reason -- one source of truth so these can never drift
 * out of sync. ambiguous_match is reused verbatim from Layer 1's own existing vocabulary
 * (owner_attention_queue already uses it for a keyword-priority tie), not a new "ambiguous"
 * value -- an AI-layer ambiguous result and a keyword-layer tie are the same owner-facing
 * situation and should read the same way everywhere they appear.
 */
export const AI_ATTENTION_REASONS = [
  "ai_low_confidence",
  "ambiguous_match",
  "human_requested",
  "ai_unavailable",
] as const;

export type AIAttentionReason = (typeof AI_ATTENTION_REASONS)[number];

/**
 * Who produced the FINAL action -- distinct from whether AI participated. Layer 4 is the
 * decision authority whenever it runs at all, whether or not classification succeeded;
 * "layer2_ai" is deliberately not a value here -- Layer 2 only classifies, it never decides.
 * AI participation is visible separately, via automation_decision_log's own
 * capability/ai_provider/ai_model/confidence columns, which stay null both when this
 * function is never reached (automation_mode='rules_only') and when classification was
 * unavailable. "human" is reserved for a future manually-recorded decision; nothing produces
 * it yet.
 */
export type DecisionSource = "layer1_rules" | "layer4_decision" | "human";

/**
 * Layer 2's output shape. Deliberately narrow: no free-form text, no generated reply --
 * matchedRuleId points at an existing internal_reply_rules row, never at AI-composed content.
 * No real producer exists yet; a later phase's AIUnderstandingProvider is what returns one of
 * these for real.
 */
export interface ClassificationResult {
  language: string | null;
  intent: string | null;
  /** 0..1 */
  confidence: number;
  entities: Record<string, string>;
  /** An existing internal_reply_rules.id this intent maps to, if any. */
  matchedRuleId: string | null;
}

/**
 * Placeholder value for "the customer explicitly asked for a person." The real AI
 * classifier's actual intent taxonomy is not finalized (that is later-phase work) -- this
 * constant exists so the one intent Layer 4 must special-case regardless of confidence has a
 * single named source, not a string repeated at each call site.
 */
export const HUMAN_SUPPORT_REQUEST_INTENT = "human_support_request";

/**
 * SUGGEST_REPLY is a future-only contract shape: no AI generation produces one in this phase
 * (nothing calls this function with a real classification yet, since no provider exists),
 * no owner-app review UI consumes it, and no code path writes it to owner_attention_queue as
 * reason='ai_suggested_needs_review' outside a unit test. A unit test exercising this branch
 * verifies the type contract is internally consistent -- it is not evidence the
 * suggested-reply product feature exists or is shipped.
 */
export type DecisionAction =
  | { kind: "AUTOMATE_REPLY"; ruleId: string }
  | { kind: "SUGGEST_REPLY"; ruleId: string }
  | { kind: "NEEDS_ATTENTION"; reason: AIAttentionReason };

export interface DecisionThresholds {
  /** Confidence at or above this -> the high tier. */
  high: number;
  /** Confidence at or above this (but below `high`) -> the medium tier. Below this -> low. */
  medium: number;
}

/**
 * Single default threshold pair for Phase 2 -- not yet business-configurable (no
 * automation_mode-adjacent override exists yet), matching this constant's role to
 * DEFAULT_TRIAL_GRACE_PERIOD_DAYS's own "one default now, override later if ever needed"
 * precedent (lib/engine/automation.ts). Carry-forward prerequisite #2
 * (docs/architecture/decisions/0035-layered-ai-automation-phase1.md) required this ordering
 * invariant be enforced before decideAction()'s first real caller existed -- enforced by a
 * unit test asserting `high >= medium` on this exact exported value, rather than a runtime
 * assertion, since the values are a compile-time constant, not user input.
 */
export const DEFAULT_DECISION_THRESHOLDS: DecisionThresholds = { high: 0.85, medium: 0.6 };

export interface DecideActionInput {
  mode: AutomationMode;
  /**
   * Layer 1 already ran and did NOT produce a confident match -- decideAction's whole
   * contract assumes this. A `matched` result is out of scope by construction: the caller
   * must short-circuit before ever reaching this function, exactly as it already does today
   * for the deterministic keyword path.
   */
  layer1Result: { outcome: "no_match" } | { outcome: "ambiguous"; tiedRules: MatchableRule[] };
  /** null = AI wasn't called (mode='rules_only'), errored, timed out, or was over budget. */
  classification: ClassificationResult | null;
  thresholds: DecisionThresholds;
}

/** 0 <= n <= 1, finite. Shared by both confidence and threshold validation below. */
function isValidUnitInterval(n: number): boolean {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
}

export function decideAction(input: DecideActionInput): DecisionAction {
  if (input.mode === "rules_only") {
    // Contract violation, not a normal branch: callers must never invoke this function at
    // all in rules_only mode -- rules_only means Layer 1's own no_match/ambiguous outcome is
    // final, unchanged. Failing loudly here means a future wiring mistake is caught
    // immediately instead of silently changing rules_only's behavior.
    throw new Error("decideAction must not be called when automation_mode is 'rules_only'");
  }

  const { classification, mode, thresholds } = input;

  // Audit finding #7: decideAction() previously trusted its numeric inputs completely, which
  // was safe only because its one real caller already validated them upstream
  // (lib/ai/validation.ts's parseClassificationResult, and a unit test asserting
  // DEFAULT_DECISION_THRESHOLDS.high >= medium). Validating here too means a future caller
  // that skips that upstream validation -- or a threshold constant edited carelessly without
  // running tests -- fails loudly and immediately rather than silently misrouting messages.
  // Same "contract violation, fail loudly" philosophy as the rules_only check above: this is
  // a programming-error class of failure, not an AI-unavailability class, so it is
  // deliberately NOT caught and downgraded to ai_unavailable.
  if (!isValidUnitInterval(thresholds.high) || !isValidUnitInterval(thresholds.medium) || thresholds.high < thresholds.medium) {
    throw new Error(
      `Invalid decision thresholds: ${JSON.stringify(thresholds)} -- expected 0 <= medium <= high <= 1`,
    );
  }
  if (classification && !isValidUnitInterval(classification.confidence)) {
    throw new Error(`Invalid classification confidence: ${classification.confidence} -- expected 0 <= confidence <= 1`);
  }

  if (!classification) {
    return { kind: "NEEDS_ATTENTION", reason: "ai_unavailable" };
  }

  if (classification.intent === HUMAN_SUPPORT_REQUEST_INTENT) {
    return { kind: "NEEDS_ATTENTION", reason: "human_requested" };
  }

  if (classification.confidence >= thresholds.high) {
    return classification.matchedRuleId
      ? { kind: "AUTOMATE_REPLY", ruleId: classification.matchedRuleId }
      : { kind: "NEEDS_ATTENTION", reason: "ai_low_confidence" };
  }

  if (classification.confidence >= thresholds.medium) {
    if (mode === "smart") {
      return { kind: "NEEDS_ATTENTION", reason: "ambiguous_match" };
    }
    // ai_assisted / advanced_ai: a medium-confidence result is worth surfacing as a
    // reviewable suggestion rather than deferring silently -- see the SUGGEST_REPLY doc
    // comment above for this phase's explicit non-goals around that path.
    return classification.matchedRuleId
      ? { kind: "SUGGEST_REPLY", ruleId: classification.matchedRuleId }
      : { kind: "NEEDS_ATTENTION", reason: "ai_low_confidence" };
  }

  return { kind: "NEEDS_ATTENTION", reason: "ai_low_confidence" };
}
