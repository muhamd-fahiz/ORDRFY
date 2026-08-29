# ADR-0019: Today-View Mutation Design — "Review" Semantics and Send-Reminder Idempotency

**Status:** Accepted (2026-08-29)

## Context

The Today view's "Review" and "Send Reminder" actions needed to become real mutations rather than local UI state, wired against the permanent RLS-scoped session established in ADR-0017 rather than the temporary service-role read path. Two concrete design questions had no obviously-correct answer handed down from any prior decision: what "Review" actually *does*, and how to prevent a manually-triggered reminder from being sent repeatedly.

## Decision

**"Review" resolves `owner_attention_queue` rows without moving the pipeline stage.** A single tap sets `resolved_at`/`resolved_by` on every unresolved attention row for that contact and logs to `activity_log`. It deliberately does not attempt to move `contacts.pipeline_stage_id` or otherwise act on *what* the message said — V1 has no in-app reply composer, so the real work (reading the message, replying on WhatsApp) always happens outside Ordrfy. Inferring the right next pipeline stage from message content would require exactly the NLP-driven understanding CLAUDE.md's "what NOT to build in V1" list excludes.

**"Send Reminder" creates a real `reminders` row and calls the actual engine synchronously.** The row is inserted through the RLS-scoped client (relying on `reminders`' existing tenant-isolation policy from Non-Negotiable Architecture Rule 3, not a new one), using `reminder_type = 'payment_due'` — the only reminder type with real seeded template content across verticals today, a documented limitation rather than a guess dressed up as a real choice. `runReminderEngineOnce()` (the same Phase 2 function the cron route calls on a schedule) is then called directly, in-process, so the owner sees a real outcome on the same tap instead of waiting up to 5 minutes for the next tick with no feedback at all.

At most one manually-triggered reminder per contact per calendar day, enforced by `reminders.idempotency_key`'s existing unique constraint (`manual-<contactId>-payment_due-<date>`), not by application-side duplicate-checking logic that could race or be bypassed.

## Alternatives Considered

- **Let "Review" also advance the pipeline stage**, since that's a natural next step for a resolved inquiry. Rejected — there's no reliable, data-driven way to know *which* stage is correct without reading and understanding the actual message content, which is out of scope.
- **Queue the manually-triggered reminder for the next cron tick rather than processing it immediately.** Rejected for this single-tap surface specifically — a tap with no visible result for up to 5 minutes fails the "fast, low-friction" design goal this whole surface is built around.
- **Prevent duplicate manual sends with an application-level "already sent today?" check before inserting.** Rejected in favor of the database-level unique constraint, which cannot race the way an app-level check-then-insert can.

## Consequences

Verified against the live stack as a real signed-in owner, not by code review: both actions produce real, checked-via-psql database changes; the idempotency guard rejects a same-day repeat without creating a duplicate row; and the mutation-side RLS boundary was isolated the same way the read-side boundary was in ADR-0017 — a raw client-side `UPDATE` against another business's `owner_attention_queue` row (no application code involved) matched zero rows, and a raw `INSERT` into another business's `reminders` was explicitly rejected with a `42501` policy violation.

This is also the first concrete application of the "keep the owner's daily, repeated actions to one tap" standing principle noted in ADR-0006 — both actions are single-tap, no form, no confirmation dialog.
