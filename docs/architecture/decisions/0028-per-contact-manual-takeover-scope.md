# ADR-0028: Per-Contact Manual Takeover — Scoped, Not Approved for Implementation

**Status:** Proposed — design/scope only, per the project owner's explicit instruction not
to implement until they approve this scope (2026-09-02)

## Context

The project owner wants a real business owner to always be able to take a conversation over
from automation for one customer at a time, without touching automation for the rest of
their customers. Requested wording: "I'll handle this customer" → automation stops for that
contact only → "Turn assistant back on" → automation resumes. They explicitly asked for this
to be designed and scoped as its own decision, separate from the copy/UX pass in ADR-0027,
and not implemented until they approve the scope below.

## Proposed Decision

**1. Database/state change required:** one new nullable column, `contacts.owner_takeover_at
timestamptz`. `NULL` = automation runs normally; a timestamp = the owner took this contact
over at that time, automation is suppressed for this contact until it's cleared. A single
column is sufficient — this is per-contact live state, not a compliance-sensitive consent
record like `reminder_channel_consent` (ADR-0003), so it doesn't need that table's
append-only design. Every transition (`takeover_started` / `takeover_ended`) is written to
`activity_log` with `actor_user_id` set (ADR-0014's existing pattern), which is what gives
this its audit trail instead of a dedicated history table.

**2. Interaction with the existing kill switch:** fully independent, same pattern as
ADR-0013's trial-expiry handling — two separate suppression conditions checked at the same
gate, never merged into one flag (Non-Negotiable Architecture Rule 7 already forbids
overloading `businesses.automation_paused` for anything but the admin-toggled, business-wide
case). The effective per-contact automation-eligibility check becomes: automation runs **iff**
`businesses.automation_paused = false` AND trial-eligible (ADR-0013) AND
`contacts.owner_takeover_at IS NULL` AND the existing opt-out/window checks all pass. This is
a new first-class condition alongside the others already listed under CLAUDE.md's `reminders`
send-eligibility gate, not a replacement for any of them.

**3. How webhook processing should behave:** unchanged at the durability layer (Non-Negotiable
Rule 4: verify signature → durably store → ack 200 → process, regardless of takeover state). A
message from a customer under takeover still gets stored, still updates
`contacts.last_inbound_at` / `contact_channel_identities.last_inbound_at` normally — the owner
handling it manually still needs Today/Customers to reflect the latest message. Only the
*processing* step's automation stage changes: template/rule matching checks
`owner_takeover_at IS NULL` before attempting any auto-reply.

**4. How an automated reply is prevented while takeover is active:** the same shared
auto-reply-matching code path that already checks opt-out first (ADR-0008: "an opt-out phrase
always wins over any other automation match") gets a sibling check — takeover also always
wins, checked at the same single point before rule/template matching runs. This keeps the
whole feature enforced once, centrally, in the shared engine (Non-Negotiable Rule 1: zero
vertical/channel conditionals), the same way the kill switch and opt-out already are.

**5. How the owner resumes automation:** a single RLS-scoped mutation — `UPDATE contacts SET
owner_takeover_at = NULL WHERE id = ... AND business_id = ...` — logged to `activity_log` as
`takeover_ended`. No auto-expiry/timeout in this proposed scope: it stays off until the owner
explicitly turns it back on, matching the requested "Turn assistant back on" wording. An
auto-expiry (e.g. "resumes automatically after 24h of owner inactivity") is a possible future
refinement, not part of this proposal.

**6. Minimum UI required:** one button on Contact Detail only, label switching by state —
"I'll handle this customer" when `owner_takeover_at IS NULL`; a "You're handling this
customer" status line plus "Turn assistant back on" when it's set. No new nav item, no
Settings toggle, no admin-panel change. Today/Attention/Customers list cards don't need their
own takeover control in this scope — if real usage later shows owners need to see/toggle it
from those screens too, that's a follow-up decision, not part of this minimum.

**7. Tests that would be required before shipping this:**
- RLS: confirm `owner_takeover_at` is covered by `contacts`' existing tenant-isolation policy
  (no new policy needed if it's a plain column, but the RLS test suite must exercise it).
- Unit: the shared auto-reply-matching function returns "no automated reply" when takeover is
  active — mirrors whatever unit test already exists for the opt-out short-circuit (ADR-0008).
- Unit: the reminders send-eligibility gate treats active takeover the same as
  `automation_paused`/trial-ineligibility — no reminder sent, with a clear `failure_reason`
  rather than the reminder silently vanishing.
- Integration, webhook-driven (matching ADR-0023's precedent — real `POST` to
  `/api/webhooks/whatsapp` and `/instagram`, not fixture inserts): a message from a contact
  under takeover is durably stored and updates `last_inbound_at`, but produces zero outbound
  `messages` row with `is_auto_reply = true`.
- Manual: toggling takeover on a contact connected on **both** WhatsApp and Instagram and
  confirming automation is suppressed on both at once — the state lives on `contacts`
  (channel-independent, Non-Negotiable Rule 2), not per `contact_channel_identities` row, so
  this needs to be checked directly rather than assumed.

## Alternatives Considered

- **Reusing `businesses.automation_paused` scoped to one contact somehow.** Not viable —
  that column is explicitly defined (Non-Negotiable Rule 7) as business-wide and
  admin-toggled only; overloading it for a per-contact, owner-toggled case is exactly the
  failure mode ADR-0013 already documents and rejects for trial-expiry.
- **A history table instead of a single column**, mirroring `reminder_channel_consent`'s
  append-only design. Rejected for this proposal — that design exists specifically for DPDP
  consent-record compliance (ADR-0003), which doesn't apply to a live on/off operational
  state; `activity_log` already gives this an audit trail without a second table.

## Consequences if approved

- Small, additive: one column, one shared-engine check added at an existing gate, one button
  on one screen. No conflict with any Non-Negotiable Architecture Rule.
- Not approved for implementation as of this ADR. Implementation should not begin until the
  project owner explicitly signs off on this scope, per their own instruction.
