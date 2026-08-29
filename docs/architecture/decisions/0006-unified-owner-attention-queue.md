# ADR-0006: Unified `owner_attention_queue` as the Single "Needs Owner Attention" Mechanism

**Status:** Accepted (2026-08-28)
**Supersedes:** Querying `reminders` directly (filtered on `status='failed' AND failure_reason='channel_unsupported'`) as the implicit "Needs Owner Attention" view.

## Context

Before this decision, "Needs Owner Attention" had no actual schema home. An unmatched or ambiguous inbound message had nowhere to be queued at all; a reminder's `channel_unsupported` failure was only discoverable by scanning `reminders` directly. At low volume an owner notices anyway; at high volume this becomes an invisible backlog with no single place to look.

## Decision

`owner_attention_queue` (`supabase/migrations/20260828120023_owner_attention_queue.sql`) unifies every reason attention is needed: `unmatched_message`, `ambiguous_match`, `media_message`, `reminder_channel_unsupported`, `manual_flag`. Oldest-unresolved-first and the always-visible count badge are both a single query against this one table (`order by created_at where resolved_at is null` / `count(*) where resolved_at is null`) — a plain count + sort order, deliberately no full-text search or polish.

This is in *addition* to `activity_log`, not a replacement: `activity_log` is the permanent audit trail; this table is the actionable, resolvable queue. The two are often written together (e.g. an unmatched message logs to both). Reminders' `channel_unsupported` failures route here instead of being surfaced via a direct query on `reminders` — one queue, not several parallel ones.

## Alternatives Considered

- **Keep querying `reminders` directly for the channel-unsupported case, add a separate ad-hoc mechanism for unmatched/ambiguous messages.** Rejected — this is exactly the "several parallel queues" outcome the unification avoids; an owner would need to check multiple places to know what needs attention.

## Consequences

Real-time/immediate alerts are reserved for a brand-new lead's first message, a payment issue, and — now trivially — any insert into `owner_attention_queue`. Everything else batches into a periodic digest (see Notes below).

## Notes

**Instant acknowledgment before the real reply is ready.** At high volume there can be a real gap between "message received" and "auto-reply/pipeline processed," during which a customer sees silence. No new table — reuses the existing `business_settings` per-business, vertical-defaulted pattern: `instant_ack_enabled` (boolean), `instant_ack_text` (vertical-appropriate default seeded at business creation, owner-editable after). Deferred to Build Phase 2: sending the ack immediately on inbound receipt, decoupled from pipeline/auto-reply processing, as universal shared-engine behavior — only the wording is vertical config data, never a per-vertical code branch. Must respect `businesses.automation_paused` like any other outbound automation.

**Batch routine notifications; only interrupt for what actually matters.** Pinging the owner on every single inbound message doesn't scale — a busy 30-message conversation becomes 30 interruptions, and at real volume owners start ignoring notifications entirely, defeating the purpose. No new table beyond this ADR's `owner_attention_queue`. Reuses `business_settings` again: `notification_digest_frequency_minutes` (per business), `last_digest_sent_at` (per business, updated by the digest job). Deferred to Build Phase 2/5: the actual digest-sending `pg_cron` job querying `activity_log` for routine events since `last_digest_sent_at` — no dedicated job-queue infrastructure needed, consistent with the standing "`pg_cron`/`pg_net` is sufficient at V1 scale" decision.

**Keep the owner's daily, repeated actions to one tap, not a form.** No schema change — the schema already supports it (marking a payment fully paid, moving a pipeline stage, or dismissing an `owner_attention_queue` item is already a single-field update once the target value is known). This is a standing UI/interaction-design constraint, not a discrete technical decision with alternatives: routine, high-frequency actions must be completable in one tap wherever the action doesn't inherently require more input. First actually implemented in ADR-0019 (Today-view mutations) — see that ADR for how "Review" and "Send Reminder" apply this concretely.
