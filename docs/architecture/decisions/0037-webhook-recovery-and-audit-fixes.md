# ADR-0037: Independent Phase 2 Audit — Recovery, Tenant-Guard, and Validation Fixes

**Status:** Accepted (2026-09-03)

## Context

An independent audit of the Phase 2 implementation (ADR-0036) found eight issues, ranging
from a genuine, confirmed message-processing-loss bug to schema-hardening and observability
gaps. All eight were reconciled against the actual code before any fix was made, fixed within
the existing Phase 1/2 scope, and verified — unit tests, SQL tests against the live local
database, typecheck, lint, a production build, and three webhook-driven verification scripts
covering the real HTTP paths (`/api/webhooks/whatsapp`, `/api/cron/reminders`). No Phase 3
work (real provider, `ai_usage_log`, RAG, dynamic routing, owner-facing configuration) was
started.

## Decision

### Finding 2 — webhook recovery could not actually recover a post-storage failure (the serious one)

**Root cause, traced precisely.** `processInboundMessage` treated a `(provider,
provider_message_id)` duplicate-insert as unconditional proof "this message was already
fully processed" and returned immediately. That row is inserted *before* automation
processing even begins, so any exception after storage (an `automation_decision_log`
write failure, any later exception) left a message durably stored but never finished — and a
retry of the *identical* webhook event would hit that same duplicate check and silently
no-op again, forever. Compounding this, `claim_stuck_webhook_event()` only ever reclaimed
`status IN ('received', 'processing')` rows past a timeout — a row that reached
`status='failed'` (a definitively recorded processing exception, as opposed to a crash before
processing started) had **no reclaim path at all**. Together: any exception after message
storage was permanently unrecoverable. This is a real, confirmed defect, not a
theoretical one — verified by first reproducing the stuck state directly (`tests/sql/011`
found 64 real orphaned `failed`/`received` rows already accumulated in the dev database from
earlier session testing, none of which any existing mechanism would ever have retried).

**Fix, both halves required together:**
- `messages.automation_processed_at` (nullable, new column) is the explicit signal Layer 1/2/4
  processing has terminally completed for that inbound message. `processInboundMessage`'s
  duplicate-insert branch now checks it: null → **resume** processing using the existing row
  (never re-insert); set → true no-op, exactly the prior (correct) behavior for a harmless
  webhook re-delivery.
- `claim_stuck_webhook_event()` now also reclaims `status='failed'` rows immediately (no
  timeout wait needed — `'failed'` already represents a finished attempt), capped by a new
  `webhook_events.attempt_count` column and a `p_max_attempts` parameter (default 5, mirroring
  `reminders.ts`'s own `MAX_ATTEMPTS` convention) so a persistently failing cause is not
  retried forever.
- Resumption safety for individual side effects: `insertAttentionItem` now checks for an
  existing row on `(reference_type, reference_id)` before inserting (a resumed pipeline run
  reaches the same terminal branch from scratch and would otherwise queue a duplicate);
  `recordAutomationDecision` now tolerates a `23505` on `automation_decision_log.message_id`'s
  unique constraint as "already recorded by an interrupted earlier attempt," not an error.
  `sendAutoReply`'s existing `outbound_idempotency_key` check already made it safe. A
  duplicate `activity_log` entry on a genuine resume (opt-out, kill-switch-skip,
  trial-skip logging) is accepted as low-severity, non-corrupting noise in an append-only
  audit table — deliberately not deduplicated, to keep the fix properly scoped.
- Verified end-to-end (`scripts/verify-webhook-recovery-resumption.mjs`, against the real
  `/api/cron/reminders` route): a message stored with `automation_processed_at` left null and
  a matching `webhook_events` row at `status='failed'` is genuinely resumed — the reply is
  sent exactly once, no duplicate message row is created, the event is marked `processed`,
  and a second recovery run does not resend. A separate scenario confirms a `failed` event
  already at the attempt cap is never reclaimed again.

### Finding 1 — an unsupported/unavailable AI provider crashed webhook processing instead of degrading

`getAIProvider("classification")` was called *outside* `escalateToAiLayer`'s try/catch, so a
misconfigured `AI_PROVIDER_CLASSIFICATION` threw synchronously and propagated to the webhook
route's outer handler — marking the event `failed` for what should have been a routine,
safely-degraded `NEEDS_ATTENTION`/`ai_unavailable` outcome. Fixed by moving provider selection
inside the same try/catch as the classification call, and introducing
`AIProviderUnavailableError` (`lib/ai/factory.ts`) so this specific failure mode is
distinguishable from a mid-call provider error or a timeout, recorded as
`fallback_reason: 'provider_unavailable'`.

**Provider metadata clarification** (the audit's closing question, answered): `ai_provider`
now records `getConfiguredProviderName()`'s result even when construction itself fails — the
audit trail shows *which* provider was attempted and could not be used, never a blank field
standing in for "we don't know." Verified live: with `AI_PROVIDER_CLASSIFICATION=claude-not-yet-real`,
the resulting row shows `ai_provider: "claude-not-yet-real"`, `fallback_reason:
"provider_unavailable"`, `action: "NEEDS_ATTENTION"`, `webhook_events.status: "processed"`
(`scripts/verify-unsupported-ai-provider.mjs`).

### Finding 3 — no tenant-consistency guard on `automation_decision_log`

Extended the existing `guard_contact_business_match()` pattern
(`20260902000001_contact_business_integrity_guard.sql`) with a new trigger,
`guard_automation_decision_log_business_match()`, checking that `business_id` matches the
referenced `message_id`'s real business, and — when non-null — the referenced
`matched_rule_id`'s real business, **unless that rule's `business_id` is itself null** (a
vertical-wide default rule, legitimately referenceable by any business of that vertical; a
plain equality check would have incorrectly rejected every such reference).

### Finding 4 — `automation_mode` CHECK constraint had the classic SQL NULL gap

`setting_value IN (...)` evaluates to `NULL`, not `FALSE`, when `setting_value IS NULL` — and
a CHECK constraint only rejects a `FALSE` result, so a `NULL` `automation_mode` value
previously passed undetected. Fixed by explicitly requiring `setting_value IS NOT NULL` in
the constraint (dropped and recreated). Regression-tested in `tests/sql/008`.

### Finding 5 — a genuine `automation_mode` lookup failure was indistinguishable from "no row"

`getAutomationMode()` previously ignored the query's `error` field entirely, so a real
database error would silently resolve to `'rules_only'` — the same outcome as the legitimate
"no row configured" case. Fixed: `error` is now checked and thrown, propagating as a real,
observable failure through the same webhook failure/recovery path Finding 2 made safe to use.
Absence of a row (`data` null, `error` null) remains a valid `'rules_only'` default,
unchanged.

### Finding 6 — `ai_assisted`/`advanced_ai` silently behaved like `rules_only`

Both modes have no implementation in this phase and correctly fall through to the same code
path as `rules_only` — but doing so *silently* meant a business explicitly configured for one
of them had no way to know its setting wasn't honored yet. Fixed by logging
`activity_log` event `automation_mode_not_yet_supported` (with the configured mode in
`event_detail`) every time this fallthrough occurs, mirroring how
`automation_skipped_kill_switch`/`automation_skipped_trial_expired` already log every skip
rather than treating it as an unremarkable default. Verified live: `activity_log` carries
this event with `configured_mode: "ai_assisted"` when that mode is set.

### Finding 7 — `decideAction()` trusted its numeric inputs completely

Safe only because its one real caller already validated them upstream
(`parseClassificationResult`, and a unit test on `DEFAULT_DECISION_THRESHOLDS`). Now validated
inside `decideAction()` itself: `confidence` and both thresholds must be finite numbers in
`[0,1]`, and `thresholds.high >= thresholds.medium`, or it throws — same "contract violation,
fail loudly" philosophy as the existing `rules_only` guard, and deliberately *not* caught
locally (a violation here is a programming-error class of failure, not an AI-unavailability
class, and safely triggers the webhook failure/recovery path now that Finding 2 makes that
path lossless).

### Finding 8 — candidate-rule tenant/vertical/language/active scoping had no integration coverage

Extended `scripts/verify-phase2-ai-classification-fallback.mjs` with four "trap rule"
scenarios, each seeding a rule that would match the test message directly if scoping ever
leaked: a different business's rule, an inactive rule, a different-vertical rule, and a
different-language rule. Each asserts both that Layer 1 never records the trap as a
`layer1_rules` match (proving it never entered the candidate array `matchKeywordRule` and
`escalateToAiLayer` share) and that Layer 4 never selects it via
`matched_rule_id`. All four passed against the existing, unmodified rule-fetch query — this
finding confirmed correct behavior rather than uncovering a defect, but the coverage did not
exist before this fix.

## Alternatives Considered

- **A superficial patch to Finding 2** (e.g., just extending `claim_stuck_webhook_event` to
  reclaim `'failed'` rows, without fixing `processInboundMessage`'s resumption logic).
  Rejected explicitly — a reclaimed `'failed'` event would still hit the old duplicate-insert
  short-circuit and silently no-op again, having accomplished nothing. Both halves were
  required, as the audit itself specified.
- **Deduplicating every `activity_log` write path for resumption safety.** Rejected as
  disproportionate — `activity_log` is an append-only audit trail; an extra identical entry
  from a rare resumed retry is informational noise, not a correctness issue, unlike a
  duplicate `owner_attention_queue` item (customer-facing queue) or `automation_decision_log`
  row (unique-constrained by design), both of which are fixed.
- **A broader AI-metadata consistency constraint on `automation_decision_log`**, reconsidered
  again here. Still not added — none of these eight findings' fixes changed the writer
  lifecycle analysis ADR-0036 already used to justify deferring it.

## Consequences

- `lib/engine/automation.ts` is restructured (extracted `runAutomationPipeline`, added
  `markMessageAutomationProcessed`) but every existing deterministic branch's *logic* is
  unchanged — verified by the full `rules_only` regression scenario still passing
  byte-for-byte.
- Three new verification scripts (`verify-phase2-ai-classification-fallback.mjs` extended,
  `verify-webhook-recovery-resumption.mjs`, `verify-unsupported-ai-provider.mjs`) join the
  project's established "test through the real path" convention.
- `webhook_events` and `messages` both gained one column each; `automation_decision_log`
  gained a tenant-guard trigger; `business_settings`'s `automation_mode` constraint was
  tightened. All are additive or tightening-only migrations.
- Phase 3 (real AI provider, `ai_usage_log`, `SUGGEST_REPLY`'s consumer) remains explicitly
  not started.
