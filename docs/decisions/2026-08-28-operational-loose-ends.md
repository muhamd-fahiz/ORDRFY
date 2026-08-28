# Ordrfy Addendum — Operational Loose Ends (Round 4, Final)

**Status: ACCEPTED (2026-08-28).** Read alongside CLAUDE.md and the prior five addenda.
Small, cheap-now-expensive-later decisions rather than architecture changes.

## 14. What happens to a business's data when they leave

**Decision**: soft-delete only in V1. `businesses.deleted_at` already exists in the schema
— use it, nothing new to build. Explicit customer/business data-deletion requests (relevant
under India's DPDP Act, per `docs/decisions/2026-08-28-round-2-recommendations.md` item 2)
are handled as a manual admin action, not a self-service feature.

**Note on a real simplification vs. the original planning set**: `Ordrfy-Final-Architecture.pdf`
Section 11 originally specified soft-delete followed by a *scheduled, automated* hard-delete
job after a 30-day window. This addendum's "no automated data export or hard-delete
pipeline in V1" is a deliberate simplification of that — soft-delete persists indefinitely
in V1 unless an admin manually intervenes for a specific deletion request. This is the
project owner's explicit decision (this addendum), so it supersedes that section of
Final-Architecture, not an oversight. Added to CLAUDE.md's "What NOT to build in V1" list so
a future session doesn't mistake the missing scheduled job for a bug.

## 15. Channel reconnection/reset flow

**Built**: `business_channel_connections.disconnected_at`
(`supabase/migrations/20260828120005_business_channel_connections.sql`) — a simple
timestamp, not a connection-history table, matching the addendum's own framing ("a reset,
not a complex re-auth flow").

**Deferred to Build Phase 4** (alongside `InteraktAdapter`/`InstagramProvider`): the actual
admin-panel disconnect/reconnect action. Disconnecting clears `connected`/`credentials_ref`/
`provider_account_id` and sets `disconnected_at`; it never touches historical
`messages`/`contacts` data. Reconnecting is a fresh connect flow reusing the same row.

## 16. Trial expiry graceful degradation

**Decision, with one deviation from the addendum's suggested implementation**: the
addendum floated reusing `automation_paused` directly for trial-expiry pausing. Built as a
**separate, computed condition instead** — `automation_paused` stays exclusively the
admin-toggled kill switch, meaning exactly one thing, matching how the Hardening Addendum
originally specified it (Section 4: "toggleable only by an authenticated admin").

**Reasoning**: if trial-expiry pausing also set `automation_paused = true`, an admin
manually un-pausing a business for an unrelated reason (e.g. after fixing an automation
bug) could accidentally resume sends for a business that's *also* trial-expired and hasn't
paid — or conversely, a business converting to `active` after grace-period pause wouldn't
automatically resume unless the code specifically remembered why it was paused in the first
place. One boolean can't safely represent two independent reasons for the same state.

**No new schema needed**: the send-eligibility check (Build Phase 2, alongside the
WhatsApp-consent/Instagram-window/opt-out checks) simply adds one more condition, computed
from columns that already exist:

```
automation eligible = NOT automation_paused
  AND (subscription_status = 'active'
       OR (subscription_status = 'trial'
           AND now() < trial_ends_at + business_settings['trial_grace_period_days'] days))
```

New `business_settings` key: `trial_grace_period_days` (per-business, vertical-defaulted at
creation, same established pattern). During the grace period and after it, inbound messages
are always durably stored and visible in the admin panel regardless of this check —
degradation only ever affects outbound automation, never data capture, consistent with how
the kill switch already behaves.

## 17. Log who/when confirmed a payment, for dispute protection

**Built, generalized beyond just payments**
(`supabase/migrations/20260828120016_activity_log.sql`): `activity_log.actor_user_id`,
a first-class nullable column (FK `auth.users`), rather than an ad-hoc jsonb key scoped only
to payment events. **Reasoning for generalizing**: "who did this" already recurs
structurally elsewhere in the planning set — kill-switch pause/unpause explicitly needs "the
admin's identity and timestamp" (Hardening Addendum Section 4), admin vertical reassignment
needs the same, and round 4 item 15's channel reconnection will too. Building one proper
column now, while `activity_log` hasn't been applied yet, avoids three different ad-hoc
jsonb conventions for the same underlying need. Null for automation-driven events (auto-reply
sent, reminder sent) — there's no human actor for those.

**Deferred to Build Phase 3+** (admin panel / payment tracking UI): the application
discipline of actually writing `actor_user_id` on every `payments.status` change from the
admin panel, and on the other actor-relevant events named above.

## Summary of build impact

| Item | Schema built now | Behavior/logic phase |
|---|---|---|
| 14. Data offboarding decision | No (`deleted_at` already existed) | Decision only — added to "What NOT to build in V1" |
| 15. Channel reconnection/reset | Yes (`disconnected_at`) | Build Phase 4 |
| 16. Trial expiry degradation | No (`business_settings` key only) | Build Phase 2 |
| 17. Payment audit logging | Yes (`activity_log.actor_user_id`, generalized) | Build Phase 3+ |
