import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { DecisionSource, ClassificationResult } from "./automation-decision";

type Client = SupabaseClient<Database>;

export interface RecordDecisionInput {
  messageId: string;
  businessId: string;
  decisionSource: DecisionSource;
  matchedRuleId: string | null;
  /** null when decisionSource is 'layer1_rules', or when the AI call produced no usable result. */
  classification: ClassificationResult | null;
  aiProvider: string | null;
  action: "AUTOMATE_REPLY" | "SUGGEST_REPLY" | "NEEDS_ATTENTION";
  fallbackReason: string | null;
  escalationReason: string | null;
}

/**
 * The single insert point for automation_decision_log
 * (docs/architecture/decisions/0036-phase2-ai-classification-wiring.md) -- both call sites in
 * automation.ts (the Layer 1 match case and the Layer 4 outcome case) go through this
 * function so the row shape is defined once, not duplicated. capability is 'classification'
 * whenever decisionSource is 'layer4_decision' -- regardless of whether the AI call actually
 * succeeded, since an attempted-but-failed classification still reflects that capability
 * (matching the writer-lifecycle analysis in ADR-0036); it stays null for 'layer1_rules' rows,
 * which never involved AI at all.
 */
export async function recordAutomationDecision(supabase: Client, input: RecordDecisionInput): Promise<void> {
  const { error } = await supabase.from("automation_decision_log").insert({
    message_id: input.messageId,
    business_id: input.businessId,
    decision_source: input.decisionSource,
    matched_rule_id: input.matchedRuleId,
    capability: input.decisionSource === "layer4_decision" ? "classification" : null,
    ai_provider: input.aiProvider,
    ai_model: null,
    confidence: input.classification?.confidence ?? null,
    detected_language: input.classification?.language ?? null,
    detected_intent: input.classification?.intent ?? null,
    action: input.action,
    fallback_reason: input.fallbackReason,
    escalation_reason: input.escalationReason,
  });
  if (error) {
    // 23505 on message_id's unique constraint: this exact decision was already recorded by
    // an earlier attempt at processing this same message that was interrupted on a LATER
    // step (audit-write-then-crash is one of the exact scenarios webhook recovery must now
    // resume through, not re-fail on -- docs/architecture/decisions/0037-webhook-recovery-and-audit-fixes.md).
    // A resumed retry reaching this point again is a safe no-op continuation, not an error.
    if (error.code !== "23505") {
      throw new Error(`Failed to record automation decision: ${error.message}`);
    }
  }
}
