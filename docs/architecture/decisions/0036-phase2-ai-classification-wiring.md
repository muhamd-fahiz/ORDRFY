# ADR-0036: Phase 2 — AI Classification Provider Wiring (`automation_mode='smart'` only)

**Status:** Accepted (2026-09-03)

## Context

Phase 1 (ADR-0035) built the decision contract (`decideAction()`) and audit schema
(`automation_decision_log`) in complete isolation — nothing called them. This ADR records
Phase 2: the first real `AIUnderstandingProvider`, its mock implementation, and the first
edit to `lib/engine/automation.ts` since Phase 1 deliberately left it untouched. Before
implementation, the project owner required three clarifications, reconciled below, plus
resolution of ADR-0035's carry-forward prerequisites #2 and #3.

## Decision

**Scope: `automation_mode='smart'` only.** `ai_assisted` and `advanced_ai` remain
schema-valid but functionally identical to `rules_only` in this phase — no code path can
reach `decideAction()` under those modes, so `SUGGEST_REPLY` still has no producer or
consumer (carry-forward prerequisite #1 remains correctly deferred, not accidentally
triggered by this phase).

**Clarification 1 — `MockAIProvider` implements the exact same `AIUnderstandingProvider`
contract a real provider will.** `lib/engine/automation.ts` obtains a provider only through
`lib/ai/factory.ts`'s `getAIProvider("classification")`, exactly mirroring
`getChannelProvider`'s established discipline (Non-Negotiable Architecture Rule 6). Nothing
in `automation.ts` or `escalateToAiLayer` branches on which provider is active; swapping
`AI_PROVIDER_CLASSIFICATION` from `mock` to a real value later is a config change only.

**Clarification 2 — `matchedRuleId: null` is a legitimate, first-class result.**
`ClassificationResult.matchedRuleId` was already nullable in Phase 1's type; this phase
confirms it in practice: `MockAIProvider`'s `SIMULATE_AI_NO_CONFIDENT_RULE` scenario returns
high confidence with `matchedRuleId: null`, and `decideAction()` correctly routes it to
`NEEDS_ATTENTION`/`ai_low_confidence` rather than being forced to pick a rule. Verified by
both a unit test and the webhook-driven verification script.

**Clarification 3 — candidate rules are the exact bounded set Layer 1 already computed, and
a fabricated rule reference is rejected, never trusted.** `ClassifyInput.candidateRules` is
the same array already fetched for `matchKeywordRule` (business override ∪ vertical default,
filtered by vertical/language/active) — never re-fetched, never widened. `lib/ai/validation.ts`'s
`enforceCandidateRuleBoundary()` is the concrete enforcement: if a provider's `matchedRuleId`
doesn't correspond to one of the exact candidates sent, it is nulled out before
`decideAction()` ever sees it. `AIUnderstandingProvider` also has no method resembling
`generateReply()` — the type system itself makes "AI invents reply content" unrepresentable,
not just discouraged. Verified by `SIMULATE_AI_UNKNOWN_RULE`: the mock deliberately returns a
non-candidate id, and both the unit test and the webhook-driven script confirm it is rejected
and no auto-reply is ever sent from it.

**Carry-forward prerequisite #2, resolved.** `lib/ai/validation.ts`'s `parseClassificationResult()`
rejects any `confidence` outside `[0,1]` (or non-numeric) before a result is ever trusted.
`DEFAULT_DECISION_THRESHOLDS` (`lib/engine/automation-decision.ts`) is asserted `high >= medium`
by a dedicated unit test, since the values are a compile-time constant, not user input, and
there is no per-business override yet to validate at runtime.

**Carry-forward prerequisite #3, resolved.** Phase 2 is `automation_decision_log`'s first
production writer. Reviewed against the actual writer lifecycle (below), two constraints
were added, and two were deliberately not:
- Added: `action` restricted to `DecisionAction`'s own kind union — deferred in Phase 1 only
  because there was no writer to validate against.
- Added: `action <> 'AUTOMATE_REPLY' OR matched_rule_id IS NOT NULL` — database-level
  enforcement of the single most important safety invariant in the whole design, so it holds
  even against a future bug that bypasses `decideAction()`'s own in-memory check.
- Not added: a broader AI-metadata consistency constraint (e.g. confidence non-null iff
  capability non-null). The writer lifecycle below already produces that pairing correctly
  by construction; a constraint enforcing it would be redundant defense without a
  corresponding real risk.

**Writer lifecycle for `automation_decision_log`** (both call sites route through
`lib/engine/decision-audit.ts`'s single `recordAutomationDecision()`, and only ever fire for
`automation_mode='smart'` businesses — a `rules_only` business triggers zero new writes, not
just an unchanged outcome):

| Case | `decision_source` | AI metadata | `action` |
|---|---|---|---|
| Layer 1 matched | `layer1_rules` | all null | `AUTOMATE_REPLY` |
| Layer 4, high confidence, real rule | `layer4_decision` | populated | `AUTOMATE_REPLY` |
| Layer 4, low/medium confidence | `layer4_decision` | populated | `NEEDS_ATTENTION` |
| Layer 4, classification null (error/timeout/malformed/invented rule id) | `layer4_decision` | `capability` set, rest null | `NEEDS_ATTENTION` |

**Reliability: the AI call is caught locally, inside `escalateToAiLayer`, never left to the
webhook route's outer catch.** Verified directly: the `SIMULATE_AI_ERROR` scenario confirms
the corresponding `webhook_events` row is still marked `processed`, not `failed` — an AI
provider failure degrades to `NEEDS_ATTENTION`/`ai_unavailable` on the first attempt, never
triggers the webhook durability recovery job (ADR-0030) for what is an expected, graceful
fallback, not an incident. A fixed `AI_CALL_TIMEOUT_MS` wrapper (`withTimeout()`) is included
now, even though `MockAIProvider` always resolves instantly, since it is cheap to add at this
call site and expensive to retrofit once a real provider exists.

## Alternatives Considered

- **Logging `automation_decision_log` rows for every business, including `rules_only`
  ones**, for a complete audit trail from day one. Rejected — the project's repeatedly
  reinforced principle is that `rules_only` should see zero new writes, not merely an
  unchanged customer-visible outcome; an unconditional audit write is a new side effect
  `rules_only` businesses would incur for no benefit to them.
- **Placing Layer 2/4 escalation logic in a separate `lib/engine/ai-escalation.ts` module**
  for independent unit-testability. Rejected — it would require exporting `automation.ts`'s
  existing private helpers (`insertAttentionItem`, `sendAutoReply`) or duplicating them;
  keeping `escalateToAiLayer` as another private function in the same file, alongside the
  existing `insertAttentionItem`/`logActivity`/`sendAutoReply`, matches the file's own
  established structure without introducing an artificial module boundary.
- **Reading `automation_mode` once per message rather than per branch.** Adopted in part:
  the mode is fetched once for whichever branch (`matched` vs. `no_match`/`ambiguous`) the
  message actually takes, matching `trial_grace_period_days`'s own unconditional-per-message
  read precedent, rather than adding a third code path just to memoize a single query.

## Consequences

- `lib/engine/automation.ts` is edited for the first time since Phase 1 — the diff is
  additive (new imports, two new private helpers, a `matched`/`no_match` restructure of the
  existing tail) with zero lines of the pre-existing opt-out/kill-switch/trial-eligibility
  gating logic touched.
- Verified end-to-end through the real `POST /api/webhooks/whatsapp` route (not fixture
  inserts, matching ADR-0023's precedent) via `scripts/verify-phase2-ai-classification-fallback.mjs` —
  8/8 scenarios passed, covering the `rules_only` regression guard, a Layer 1 direct match
  under `smart` mode, a Layer 4 `AUTOMATE_REPLY`, `NEEDS_ATTENTION` on low confidence, the
  provider-error fallback (webhook event stays `processed`), the candidate-rule boundary
  rejecting an invented rule id, `ai_assisted`'s deliberate inertness, and the kill switch
  still gating before any AI call.
- Carry-forward prerequisite #1 (`ai_suggested_needs_review`'s vocabulary reconciliation)
  remains open — `SUGGEST_REPLY` still has no producer or consumer anywhere in the codebase
  after this phase.
- No real AI provider, no `ai_usage_log`, no RAG, no dynamic routing, no cross-model retry,
  no owner-facing configuration — all remain out of scope, unchanged from every prior locked
  decision.
