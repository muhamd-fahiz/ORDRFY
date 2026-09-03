# ADR-0038: Final Phase 2 Hardening Pass — Atomicity, Retry Caps, and Integrity

**Status:** Accepted (2026-09-03)

## Context

A second independent audit of the Phase 2 + ADR-0037 fixes found six further issues,
concentrated on concurrency correctness and the completeness of the retry cap introduced in
ADR-0037. Reconciled against the actual code, fixed within Phase 1/2 scope, and verified —
unit tests, all 12 SQL test files against the live local database, typecheck, lint, a
production build, and four webhook-driven scripts (one new, covering the atomic-claim
mechanism specifically). No Phase 3 work was started.

## Decision

### Finding 1 — retry cap did not apply to `received`/`processing`, only `failed`

ADR-0037's fix added `attempt_count < p_max_attempts` only to the `status='failed'` branch of
`claim_stuck_webhook_event()`. The `status IN ('received','processing')` branch had no cap at
all — a row stuck in one of those states past the timeout would be reclaimed every timeout
period, forever. Fixed by moving the attempt-count check to apply uniformly across all three
reclaimable states. Regression-tested in `tests/sql/011` with a `processing`-status row
seeded already past its timeout AND already at the cap — exactly the case the original fix
missed.

### Finding 2 — automation processing was not atomic under true concurrency

The most significant finding. `processInboundMessage`'s resume path (a duplicate
`(provider, provider_message_id)` insert) checked `automation_processed_at` and, if unset,
proceeded straight to `runAutomationPipeline` — a plain SELECT-then-act sequence with a real
race window between two concurrent callers (a live webhook retry-delivery racing a recovery
job tick, or two overlapping recovery ticks) that could both observe "not yet processed" and
both run the pipeline.

**Fix:** a new `messages.automation_claimed_at` column and `claimMessageForProcessing()`, the
same atomic `UPDATE ... WHERE ... RETURNING` compare-and-swap pattern already used by
`claim_next_reminder()`/`claim_stuck_webhook_event()`. A fresh insert establishes its own
claim as part of the same INSERT statement (uncontested by construction — nothing else can
reference a row that didn't exist a moment earlier); the resume path must explicitly win the
same atomic claim, using a 2-minute staleness window (`MESSAGE_CLAIM_STALE_MS`) chosen to be
far shorter than `claim_stuck_webhook_event`'s own 10-minute default — by the time recovery
even looks at a webhook event, that much time has already passed, so a much shorter
message-level window remains safely conservative against a merely-slow, still-live attempt.

Verified with a genuine concurrency test (`scripts/verify-atomic-message-claim.mjs`): two
identical inbound requests for the same `provider_message_id`, fired via `Promise.all` so
both are truly in flight simultaneously. The causal reasoning for why this is deterministic,
not merely probably-true: only one of the two concurrent INSERTs can win the unique
constraint; the loser's failure can only be reported back *after* the winner's insert has
already committed — so the loser's subsequent lookup is guaranteed to see the winner's fresh
claim and correctly fail to acquire its own, regardless of exact request timing. Confirmed:
exactly one message row, exactly one reply sent, both `automation_claimed_at` and
`automation_processed_at` end up set.

### Finding 3 — Needs Attention idempotency relied on SELECT-then-INSERT

ADR-0037 added a SELECT-then-INSERT guard to `insertAttentionItem` as a resumption-safety
measure — itself a TOCTOU race under true concurrency (two concurrent claims of the same
message could both SELECT and see nothing, then both INSERT). Fixed with a real database
constraint: `idx_owner_attention_queue_reference_unique`, a partial unique index on
`(reference_type, reference_id) WHERE reference_id IS NOT NULL` (partial so a `manual_flag`
entry, which has no reference_id, remains uniqueness-exempt — an owner flagging the same
contact more than once is not a duplicate). Application code now performs a plain INSERT and
treats a `23505` on this index as an idempotent no-op — the same conflict-safe-write pattern
already used for `messages(provider, provider_message_id)` and
`automation_decision_log(message_id)`, rather than a new pattern (upsert-based conflict
resolution was considered and rejected: Postgres's `ON CONFLICT` target inference does not
match a partial index unless the predicate is also specified in the conflict target, which
Supabase's JS client does not expose — the catch-23505 approach already established elsewhere
in this codebase avoids that complication entirely).

### Finding 4 — shared-rule vertical integrity

ADR-0037's tenant guard trigger correctly rejected a `matched_rule_id` belonging to a
*different business*, but performed no check at all for a *shared* rule
(`internal_reply_rules.business_id IS NULL`). A shared rule is valid for any business — but
only of the matching vertical; logging a `tutor`-vertical shared rule against a
`fashion`-vertical business is a real integrity violation (that rule could never actually
have been a legitimate Layer 1/2 candidate for that business), even though it isn't a
cross-tenant leak. Fixed by extending `guard_automation_decision_log_business_match()`: when
the referenced rule's `business_id` is null, look up the logging business's own `vertical`
and require it to match the rule's `vertical`. This does **not** duplicate the full
candidate-selection engine (vertical + language + active filtering) in the database — per
explicit instruction, only this one integrity invariant is enforced at the trigger level;
language and active-status remain correctly the application boundary's responsibility
(`lib/ai/validation.ts`'s `enforceCandidateRuleBoundary`, fed by `automation.ts`'s own
already-filtered query).

### Finding 5 — a failed `automation_processed_at` write could silently report success

If `markMessageAutomationProcessed`'s own UPDATE failed or matched zero rows, the prior code
proceeded as though webhook processing succeeded — the webhook route would then mark the
`webhook_events` row `processed`, removing it from recovery's view *permanently*, while the
message itself remained claimed-but-never-marked-done with no future path back to it (nothing
revisits a webhook event already marked done). Fixed: this function now checks the update's
`error` and row count, throwing on either failure. This propagates to the webhook route's
outer catch, which marks the event `failed` — genuinely retryable, not silently lost. Safe by
construction: every side effect `runAutomationPipeline` can produce is already idempotent
(`sendAutoReply`'s `outbound_idempotency_key`, `insertAttentionItem`'s new unique index,
`recordAutomationDecision`'s tolerated `23505`), so a resumed re-run after this specific
failure mode re-verifies each step already happened and quickly reaches the same update again.

### Finding 6 — stale documentation

`automation-decision.ts`'s top-of-file comment still said "NOT WIRED IN YET," written before
Phase 2 wired `decideAction()` into `escalateToAiLayer`. Corrected to describe the actual
current call site and re-state, accurately, that `ai_assisted`/`advanced_ai` still never
reach this function at all.

## Explicit Non-Changes (per instruction)

- `ai_assisted`/`advanced_ai` remain unimplemented and inert — no behavior was added for
  either.
- No real AI provider, no generation, no RAG/vector storage, no embeddings, no model routing,
  no `SUGGEST_REPLY` consumer.
- `lib/engine/reminders.ts` and both webhook routes are untouched — confirmed by an empty
  `git diff`.
- The candidate-rule application boundary (`enforceCandidateRuleBoundary`,
  `lib/ai/validation.ts`) is unchanged; Finding 4's trigger fix adds one integrity check, not
  a duplicate of that engine.

## Vitest EPERM Investigation

Could not reproduce a spawn EPERM error in this session: tried `npm run test`, direct
`npx vitest run` with both `--pool=forks` and `--pool=threads`, and invocation from both
git-bash and PowerShell — all passed cleanly every time. The project's CI
(`.github/workflows/ci.yml`) runs on `ubuntu-latest`, where this class of Windows-specific
worker-spawn permission issue does not apply at all. Since the failure mode could not be
observed directly, `vitest.config.ts` was given an explicit `pool: "forks"` as a low-risk,
zero-downside preventive measure (`forks` uses plain `child_process.fork`, generally more
tolerant of restrictive local security policies or antivirus/EDR interference than the
default `threads` pool's `worker_threads` spawning) — documented honestly as unverified
against the actual reported failure, not a confirmed fix for a reproduced bug.

## Consequences

- `messages` and `webhook_events` each gained one more column
  (`automation_claimed_at`, none — Finding 1 changed function logic only, not schema);
  `owner_attention_queue` gained a partial unique index; the tenant-guard trigger function was
  extended in place (same signature, `CREATE OR REPLACE`).
- `lib/engine/automation.ts`'s claim/resume logic is now a genuine atomic mechanism, not a
  check-then-act sequence — verified deterministically, not just by inspection.
- All prior ADR-0035/0036/0037 boundaries hold unchanged: `automation_mode='smart'` only,
  Phase 3 not started.
