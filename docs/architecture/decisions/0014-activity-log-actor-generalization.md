# ADR-0014: `activity_log.actor_user_id` Generalized Beyond Payments

**Status:** Accepted (2026-08-28)

## Context

A payment marked paid from a manually-reviewed UPI screenshot needs a "who and when" audit trail if a customer later disputes it — the original request scoped this need to payment-status changes specifically.

## Decision

Built as a first-class, nullable `activity_log.actor_user_id` column (FK `auth.users`), generalized beyond just payment events, rather than an ad-hoc jsonb key scoped only to that one case (`supabase/migrations/20260828120016_activity_log.sql`). Null for automation-driven events (auto-reply sent, reminder sent) — there is no human actor for those.

## Alternatives Considered

- **An ad-hoc jsonb key on `event_detail`, scoped to payment events only.** Rejected — "who did this" already recurs structurally elsewhere in the planning set: kill-switch pause/unpause explicitly needs "the admin's identity and timestamp" (Hardening Addendum Section 4), admin vertical reassignment needs the same, and channel reconnection (ADR-0012) will too. Building one proper column now, while `activity_log` hadn't yet been applied, avoids three or more different ad-hoc jsonb conventions for the same underlying need appearing over time.

## Consequences

Deferred to Build Phase 3+ (admin panel / payment tracking UI): the application discipline of actually writing `actor_user_id` on every `payments.status` change from the admin panel, and on the other actor-relevant events named above. ADR-0017 and ADR-0019 (this session's owner-app work) already write it correctly for owner-initiated mutations (attention-queue resolution, manually-triggered reminders).
