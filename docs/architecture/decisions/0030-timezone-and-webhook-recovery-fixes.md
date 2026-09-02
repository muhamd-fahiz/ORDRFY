# ADR-0030: Manual Reminder Timezone Fix and Webhook Recovery Worker

**Status:** Accepted (2026-09-02)

## Context

Two items from a broader independent audit review (see the read-only findings report earlier
in this session's history) were approved for a fix, explicitly scoped to only these two:

1. **Manual reminder timezone handling.** `app/api/app/reminders/send-now/route.ts`'s "at most
   one manual reminder per contact per day" idempotency key computed "today" from the
   server's UTC clock, not the business's own calendar day. Every business in this product is
   IST (`Asia/Kolkata`, UTC+5:30). The UTC date only rolls over at 5:30 AM IST, so for a real
   5.5-hour window every day (12:00 AM–5:29 AM IST), the computed key mismatched what any
   human would call "today" — producing a false "already sent today" rejection on one side of
   that boundary, and silently allowing two reminders within a single IST calendar day on the
   other side.
2. **Missing webhook recovery worker.** `webhook_events`' own migration comment
   (20260828120017) already promises this: *"A crash after storage but before processing
   leaves the row safely in `received` status for a recovery job to find and reprocess."* No
   such job was ever built. If the server process died in the window between acking a webhook
   and its `after()` callback finishing processing, that row — and the customer message it
   represents — was lost permanently, since the provider already got its 200 and never
   retries.

Explicitly out of scope for this pass (per the project owner's instruction): auto-reply
network error handling, provider-account uniqueness, and webhook idempotency itself — all
deferred to individual review, either before real provider integration or not at all.

## Decision

**Timezone fix:** extracted the date computation into a new, dependency-free function,
`getBusinessDateString(timezone, now?)` in `lib/engine/business-day.ts` — no Next.js or
Supabase imports, deliberately, so it's cleanly unit-testable without pulling in
request-context-dependent modules. The send-now route now selects the business's own
`timezone` column (already existed for exactly this purpose, per ADR-0007) alongside
`vertical`, and passes it through `manualIdempotencyKey(contactId, timezone, now?)`. No
schema change — this reads a column that already existed and was simply never consulted here.

**Webhook recovery:** mirrors `claim_next_reminder()` / `recover_stuck_reminders()` exactly.
`supabase/migrations/20260902000002_webhook_event_recovery.sql` adds
`claim_stuck_webhook_event(p_timeout_minutes default 10)` — a single-row, `FOR UPDATE SKIP
LOCKED` claim, service-role-only (same revoke/grant pattern as its sibling), matching on
`status in ('received', 'processing')` with `received_at` older than the timeout. Matching
`'processing'` too (not just `'received'`) means a recovery attempt that itself dies mid-
reprocess is picked up again on a later run — `received_at` never changes once set, so it
stays a reliable "how long has this been unresolved" clock regardless of how many recovery
attempts have already touched the row. No new `locked_at` column was needed for this, unlike
reminders — there is no concurrent multi-worker claiming scenario to protect against here,
only "did the one attempt that had this event ever finish."

`recoverStuckWebhookEvents()` (new export in `lib/engine/webhook-durability.ts`) loops
claiming and reprocessing up to a cap, re-deriving everything needed purely from the
already-durably-stored row (`raw_payload`, `provider`, `channel_id`) — resolve the business
via `resolveBusinessIdFromProviderAccount()`, normalize via the channel's own provider
adapter, run `processInboundMessage()`, then mark processed or failed with the existing
`markWebhookProcessed`/`markWebhookFailed` functions, unchanged. It is self-contained (creates
its own service-role client), matching `runReminderEngineOnce()`'s own pattern for
cron-invoked work. `app/api/cron/reminders/route.ts` now calls it on the same tick, before the
reminder engine — reusing the existing pg_cron schedule, secret, and endpoint rather than
adding a second one for what is the same kind of periodic maintenance sweep the reminder
engine already runs internally.

**Deliberately not touched:** neither webhook route's own inline processing logic. The
recovery function independently re-implements the same short reprocessing sequence rather
than extracting a shared helper the two existing, already-tested routes would need to be
refactored to use — per the project owner's explicit "no unrelated cleanup or refactoring"
constraint, a small amount of duplication was accepted over touching working, sensitive
webhook-durability code that wasn't part of the approved scope.

## Alternatives Considered

- **A separate pg_cron schedule and endpoint for webhook recovery**, mirroring
  `/api/cron/reminders` as its own standalone thing. Rejected — CLAUDE.md's own stated
  position ("a dedicated job queue... pg_cron/pg_net is sufficient at V1 scale") argues for
  reusing the one existing periodic mechanism, not multiplying schedules for every small
  maintenance need; this was also the project owner's explicit instruction ("do not invent a
  new architecture").
- **A `locked_at` column on `webhook_events`**, mirroring reminders exactly. Not needed:
  reminders' `locked_at` protects against many *concurrent* workers claiming the same row
  under load; webhook recovery has no such concurrent-worker scenario, and `received_at`
  alone already gives a stable, monotonic staleness signal.
- **Refactoring the two webhook routes to share the new reprocessing logic** with the
  recovery function. Rejected for this pass specifically because it touches already-working
  code outside the approved scope; flagged here as a reasonable future cleanup, not done now.

## Consequences

- Both fixes are small and isolated: one new pure utility function + its call site (timezone),
  one new SQL function + one new exported function + a two-line addition to an existing route
  (webhook recovery).
- New regression coverage: `tests/unit/business-day.test.ts` (6 cases) proves the exact
  IST/UTC boundary in both directions — the false-rejection case and the false-double-allow
  case — using fixed, controlled timestamps, not live clock dependence.
  `scripts/verify-webhook-recovery.mjs` (mirrors `verify-reminder-send-now-scoping.mjs`'s
  "test through the real cron route" convention) proves: a genuinely stuck event is recovered
  and produces exactly one inbound message; a fresh, not-yet-due event is left untouched; a
  stuck event whose account can't be resolved is marked failed rather than left stuck forever;
  and running recovery twice does not create a duplicate message (idempotency).
- Full regression run, all green: `test:sql` 6/6, `vitest` 31/31 (25 prior + 6 new),
  `launch-acceptance-check.mjs` 14/14, `verify-reminder-send-now-scoping.mjs` 3/3 (prior
  round's fix, re-confirmed unaffected), typecheck, lint, production build.
