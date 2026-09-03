# ADR-0035: Layered AI Automation, Phase 1 — Decision Contract and Audit Schema Only

**Status:** Accepted (2026-09-03)

## Context

The project owner decided to evolve automation from keyword-only matching toward a layered
architecture that can eventually understand natural, mixed-language customer messages
(English/Hindi/Hinglish/Malayalam/Manglish/Tamil/Tanglish/Kannada/Kanglish and future Indian
languages) without replacing the existing deterministic engine. Three rounds of architecture
review preceded this ADR, covering: whether to build AI now vs. after Security Hardening;
a full 5-layer design (Rules → Language/Intent Understanding → Business Knowledge → AI
Decision → Human Safety/Escalation); and a multi-model strategy (separating classification
from any future generation capability, provider/model selection via static config, no
dynamic router, no cross-model retry). All three were approved. This ADR records the
resulting Phase 1 scope and the vocabulary corrections made before implementation.

## Decision

**Layer 4 (the deterministic decision authority) is built now, as a pure function with zero
AI dependency.** `decideAction()` (`lib/engine/automation-decision.ts`) takes Layer 1's
already-failed match result plus an optional `ClassificationResult` and returns one of
`AUTOMATE_REPLY` / `SUGGEST_REPLY` / `NEEDS_ATTENTION`. It is not called from
`lib/engine/automation.ts` or anywhere else — no AI provider, no factory, no mock, and no
`ai_usage_log` exist yet. Those are later phases (tracked in `docs/decisions-register.md`),
gated on this contract being proven correct in isolation first.

**Capability-aware audit schema, from its first migration.** `automation_decision_log`
(`supabase/migrations/20260903000001_automation_decision_log.sql`) carries `capability`
(currently only `'classification'` is valid), `ai_provider`, `ai_model`, `input_units`,
`output_units` from day one, per the locked multi-model decision — adding these later would
mean a second migration plus backfill guesswork instead of an empty column now. "Units," not
"tokens": not every current or future provider bills in tokens.

**`decision_source`, not `handled_by`.** The column naming the final decision-maker is
`decision_source`, with values `layer1_rules` / `layer4_decision` / `human`. An earlier draft
used `layer2_ai`, which was rejected during review: Layer 2 only classifies, it never decides
— Layer 4 is always the decision authority whenever it runs at all, including when
classification failed (`ai_unavailable` is still a `layer4_decision`, just with null AI
metadata columns). AI participation is visible separately, never conflated with who decided.

**One canonical reason vocabulary, shared by three places that previously disagreed.** An
earlier draft had `DecisionAction`'s `NEEDS_ATTENTION` reason returning `"ambiguous"` while
`owner_attention_queue.reason`'s widened CHECK used `"ambiguous_match"`, and the decision
matrix could produce `"ai_unavailable"` with no matching allowed queue value at all. Resolved
by:
- Reusing `ambiguous_match` verbatim (Layer 1's own existing vocabulary — a keyword-priority
  tie and an AI-layer ambiguous result are the same owner-facing situation).
- Adding `ai_unavailable` to `owner_attention_queue`'s CHECK
  (`supabase/migrations/20260903000002_ai_needs_attention_reasons.sql`), since
  `decideAction()`'s own contract can produce it — leaving it out now would only mean a second
  migration the day a later phase wires the call site.
- Defining the vocabulary exactly once, `AI_ATTENTION_REASONS` /
  `AIAttentionReason` in `lib/engine/automation-decision.ts`, as the single source `DecisionAction`,
  the queue's CHECK constraint, and every future test are written against.

**`SUGGEST_REPLY` is a future-only contract shape, documented as such in code.** No AI
generation produces one in this phase (nothing calls `decideAction()` with a real
classification — no provider exists yet), no owner-app review UI consumes it, no code path
writes `reason='ai_suggested_needs_review'` outside a unit test. A unit test exercising this
branch verifies the type contract is internally consistent; it is not evidence the
suggested-reply product feature exists.

**`ai_usage_log` is not created in this phase.** There is no AI usage yet to record. When it
is introduced (the phase that adds a real provider), its first migration must include
`capability`, `provider`, `model`, `input_units`, `output_units` — a timing clarification,
not a change to the capability-aware architecture decision itself.

**`automation_mode` is a `business_settings` row, DB-validated.** `setting_key='automation_mode'`,
one of `rules_only` / `smart` / `ai_assisted` / `advanced_ai`
(`supabase/migrations/20260903000003_automation_mode_setting_guard.sql`). Absence of a row
means `rules_only` — resolved in application code, matching `trial_grace_period_days`'
existing default-when-absent pattern — so no business needed a row written for this phase.
The CHECK constraint is a deliberate, narrow deviation from this table's usual
unconstrained-`setting_value` convention, justified because this key controls whether
AI-driven automation runs at all, not a display preference.

## Alternatives Considered

- **Naming the decision-source column `handled_by` with a `layer2_ai` value.** Rejected —
  misrepresents where control lives; Layer 2 classifies, Layer 4 decides, always.
- **A new `"ambiguous"` reason distinct from `ambiguous_match`.** Rejected — the project
  owner's explicit preference was to preserve existing terminology, and there is no real
  owner-facing distinction between a keyword-priority tie and an AI-layer ambiguous result.
- **Adding a CHECK constraint on `automation_decision_log.action`.** Considered, deferred —
  not part of the corrections requested, and adding unrequested constraints in the same pass
  as resolving a specific vocabulary mismatch risked looking like scope creep in review. Left
  as a plain `not null text` column; a future ADR can add this cheaply if wanted.
- **Populating `automation_decision_log` from Layer 1's existing outcomes now**, to get
  real audit data immediately. Rejected — would require editing `lib/engine/automation.ts`
  in this phase, which the project owner's scope explicitly excludes ("no changes to existing
  deterministic automation behavior"). Deferred to the phase that adds the real call site.

## Consequences

- Zero lines changed in `lib/engine/automation.ts`, `lib/engine/automation-matching.ts`,
  either webhook route, or `lib/engine/reminders.ts`. `automation_mode='rules_only'` (the
  default for every business) is provably identical to today's behavior because nothing
  anywhere reads `automation_mode`, calls `decideAction()`, or writes to
  `automation_decision_log`.
- `decideAction()` throws if called while `mode === 'rules_only'`, deliberately, so a future
  wiring mistake in the next phase is caught immediately rather than silently changing
  `rules_only`'s behavior.
- The next phase (`AIUnderstandingProvider` interface + `MockAIProvider`, wired behind
  `automation_mode` defaulting off) is unblocked but explicitly not started here.

## Carry-Forward Prerequisites for Later Phases

Surfaced by the independent Phase 1 verification review (2026-09-03) and confirmed by the
project owner as required future work, not present-phase defects. None of these block Phase
1's own completion or require any Phase 1 code change — each is a precondition attached to a
specific future trigger, recorded here so it is not rediscovered from scratch when that
trigger arrives. Phase 2 must not begin until these are acknowledged by whichever future
session starts it.

1. **Still open, unaffected by Phase 2 (ADR-0036).** Reconcile `ai_suggested_needs_review`
   with the TypeScript canonical vocabulary before any live `SUGGEST_REPLY` producer or
   consumer is built. `AI_ATTENTION_REASONS` /
   `AIAttentionReason` (`lib/engine/automation-decision.ts`) covers the four `NEEDS_ATTENTION`
   reasons but not this one, which exists only in `owner_attention_queue`'s widened CHECK
   constraint (`supabase/migrations/20260903000002_ai_needs_attention_reasons.sql`) and in
   prose/test literals — never a shared constant. Add a named constant (e.g. extend the
   shared vocabulary, or introduce a sibling constant for reasons written alongside a
   `SUGGEST_REPLY` decision) before writing the insert that pairs one with an
   `owner_attention_queue` row, so the database and application contract cannot drift the way
   this review found them already starting to.

2. **Resolved by Phase 2 (ADR-0036).** Validate `decideAction()`'s numeric inputs before its
   first real caller exists: `classification.confidence` range-checked at
   `lib/ai/validation.ts`'s `parseClassificationResult()`, and `thresholds.high >= thresholds.medium`
   asserted by a unit test on the exported `DEFAULT_DECISION_THRESHOLDS` constant.

3. **Resolved by Phase 2 (ADR-0036).** Re-examined `automation_decision_log`'s deferred
   constraints against its actual first writer's lifecycle: `action` is now restricted to
   `DecisionAction`'s own kind union, and `AUTOMATE_REPLY` now requires a non-null
   `matched_rule_id` at the database level. Broader AI-metadata consistency constraints
   remain deliberately unadded — the writer already produces that pairing correctly by
   construction, per ADR-0036's own "Alternatives Considered."
