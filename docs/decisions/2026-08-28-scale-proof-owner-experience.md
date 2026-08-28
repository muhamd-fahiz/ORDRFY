# Ordrfy Addendum — Scale-Proof Owner Experience (Round 3)

**Status: ACCEPTED (2026-08-28).** Read alongside CLAUDE.md and the two prior addenda. Core
goal: a business owner using Ordrfy should feel the same low operational load whether they
have 5 customers or 1,000 — no lead should ever silently fall through, and the owner should
never be overwhelmed by noise either.

## 6. Track and pre-warn on WhatsApp messaging tier limits

**Problem:** New WhatsApp Business numbers start capped at a business-initiated
conversation tier (commonly 250/1K/10K/100K/unlimited per rolling 24h period) that Meta
raises automatically based on messaging quality and consistent usage — not instantly. A
sudden customer-base spike can hit the cap right when Ordrfy needs to work best.

**Built now**: `business_channel_connections` gains `current_tier`, `tier_usage_today`,
`tier_last_synced_at` (`supabase/migrations/20260828120022_whatsapp_tier_tracking.sql`) —
nullable, WhatsApp-specific, unused until Build Phase 4.

**Deferred to Build Phase 4** (real provider integration, alongside `InteraktAdapter`):
- Actually syncing `current_tier`/`tier_usage_today` from Interakt/Meta's API. There is no
  real tier to sync in mock mode, and no local computation can substitute for Meta's
  authoritative assignment — building a guessed version now would just need replacing.
- Admin panel warning at a configurable threshold (e.g. 80%) before sends start failing.
- Admin panel copy explaining how tier increases work (steady usage with real unique
  customers over a rolling week raises the tier automatically; a bulk contact dump does
  not).

## 7. Give the "Needs Owner Attention" bucket urgency, not just existence

**Problem:** Before this addendum, "Needs Owner Attention" had no actual schema home. An
unmatched/ambiguous inbound message had nowhere to be queued at all; a reminder's
`channel_unsupported` failure was only discoverable by scanning `reminders` directly. At
low volume an owner notices anyway; at high volume this becomes an invisible backlog.

**Built** (`supabase/migrations/20260828120023_owner_attention_queue.sql`):
- `owner_attention_queue` unifies every reason attention is needed: `unmatched_message`,
  `ambiguous_match`, `media_message`, `reminder_channel_unsupported`, `manual_flag`.
- Oldest-unresolved-first and the always-visible count badge are both a single query against
  this one table (`order by created_at where resolved_at is null` / `count(*) where
  resolved_at is null`), matching the "plain count + sort order, no full-text search or
  polish needed" scope from the original recommendation.
- This is in *addition* to `activity_log`, not a replacement for it — `activity_log` is the
  permanent audit trail; this table is the actionable, resolvable queue. The two will often
  be written together (Build Phase 2: an unmatched message logs to both).
- Reminders' `channel_unsupported` failures now route here (see the updated comment on
  `reminders.failure_reason`) instead of being surfaced via a direct query on `reminders` —
  one queue, not several parallel ones.

## 8. Send an instant acknowledgment before the real reply is ready

**Problem:** At high volume there can be a real gap between "message received" and
"auto-reply/pipeline processed," during which a customer sees silence and may assume
they're being ignored.

**Decision**: no new table. Reuses the existing `business_settings` per-business,
vertical-defaulted-at-creation pattern (the same one already used for
`payment_reminder_delay_days` / `follow_up_silence_hours`):
- `instant_ack_enabled` (boolean, per business)
- `instant_ack_text` (string, vertical-appropriate default seeded at business creation,
  owner-editable after)

**Deferred to Build Phase 2** (shared engine): sending the ack immediately on inbound
receipt, decoupled from pipeline/auto-reply processing, as universal shared-engine
*behavior* — only the wording is vertical config data, never a per-vertical code branch.
Must respect `businesses.automation_paused`: the kill switch suppresses *all* outbound
automation, and the ack message is outbound automation, full stop — this needs no new rule,
just correct implementation against the existing one.

## 9. Batch routine notifications; only interrupt for what actually matters

**Problem:** Pinging the owner on every single inbound message doesn't scale — a busy
30-message conversation becomes 30 interruptions, and at real volume owners start ignoring
notifications entirely, defeating the purpose.

**Decision**: no new table beyond what #7 already added. Real-time/immediate alerts are
reserved for: a brand-new lead's first message, a payment issue, and — now trivially — any
insert into `owner_attention_queue`. Everything else (ongoing back-and-forth within an
already in-progress pipeline stage) batches into a periodic digest instead.

Reuses `business_settings` again for the configurable piece:
- `notification_digest_frequency_minutes` (per business)
- `last_digest_sent_at` (per business, updated by the digest job)

**Deferred to Build Phase 2/5**: the actual digest-sending `pg_cron` job querying
`activity_log` for routine events since `last_digest_sent_at`. No dedicated job-queue
infrastructure needed — consistent with the standing "`pg_cron`/`pg_net` is sufficient at V1
scale" decision.

## Summary of build impact

| Item | Schema built now | Behavior/logic phase |
|---|---|---|
| 6. WhatsApp tier tracking | Yes (nullable columns) | Build Phase 4 |
| 7. Attention-bucket triage | Yes (`owner_attention_queue`) | Build Phase 2 (writes), Phase 3+ (admin UI) |
| 8. Instant acknowledgment | No (business_settings keys only) | Build Phase 2 |
| 9. Notification batching | No (business_settings keys only) | Build Phase 2/5 |
