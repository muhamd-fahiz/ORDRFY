# Ordrfy Addendum — Instagram → WhatsApp Consent-Based Reminder Routing

**Status: ACCEPTED (2026-08-28).** Supersedes the "window-check + Needs Owner Attention
fallback" resolution originally recorded in CLAUDE.md's "Known blockers" #4. This is a
legitimate architecture change under the project's own change-control rule (a genuine
provider limitation — Meta's Instagram out-of-window messaging restrictions — not a
hypothetical concern).

## Background

Instagram's Messaging API cannot send automated business-initiated messages (fee due,
payment due, appointment reminder) once a customer's 24-hour messaging window has closed.
The message tags that used to allow this (`CONFIRMED_EVENT_UPDATE`, `ACCOUNT_UPDATE`,
`POST_PURCHASE_UPDATE`) were deprecated by Meta on April 27, 2026. The remaining Human
Agent tag only permits manually-typed messages from a real person — using it for automated
sends is a policy violation Meta actively detects.

WhatsApp has the same underlying constraint (you can't message outside the window without
consent either) but solves it with pre-approved templates — which still require the
customer to be reachable on WhatsApp in the first place.

**Decision:** route Instagram customers' reminders through WhatsApp, with explicit customer
consent captured once. This solves both platforms' consent requirement in a single flow,
instead of needing separate handling for each.

## Feature: consent-based channel linking for reminders

**Trigger** — ask for WhatsApp opt-in at one (or both) of these points, config-driven per
business, not hardcoded:

1. Onboarding — first meaningful interaction with a new Instagram contact.
2. Just-in-time — right before the first reminder would otherwise be due for that contact,
   if no consent has been captured yet.

**Conversation flow** (bot-initiated, within an open Instagram window only):

1. Bot sends: "We send fee/appointment reminders by WhatsApp so you never miss one. Okay to
   text you at a WhatsApp number for that?" (exact copy is vertical-configurable, not
   hardcoded).
2. Customer replies with consent + a phone number (or declines).
3. On consent: store the number, mark consent granted, no merge of the underlying contact
   record — this is the same contact, now with a second channel identity, not a new
   contact.
4. On decline / no response: contact stays Instagram-only. Reminders that would have gone
   automated instead get logged and surfaced for manual owner follow-up.

## Explicit exception to the no-auto-merge rule

CLAUDE.md's non-negotiable rule #2 ("no auto-merge across channels in V1, manual link is
V1.5") is about the *system* guessing two identities are the same person. This is
different: the customer explicitly confirms it themselves in the chat. This flow is
allowed in V1 as a **customer-confirmed link**, not an inference. This does not depend on
or unblock the V1.5 auto-merge item — they are unrelated capabilities.

## Schema

Reuses `contact_channel_identities` — no new identity table needed. When a WhatsApp
identity row is created via this flow (`channel_id = whatsapp`), `provider_metadata` jsonb
records how it was obtained:

```json
{ "linked_via": "instagram_consent_flow", "consented_at": "<timestamp>" }
```

New table `reminder_channel_consent` (see
`supabase/migrations/20260828120019_reminder_channel_consent.sql`):

```
reminder_channel_consent
  id, contact_id, business_id,
  requested_channel_id (FK channels, e.g. whatsapp),
  source_channel_id (FK channels, e.g. instagram),   -- where the ask happened
  status ('pending' | 'granted' | 'declined' | 'no_response'),
  requested_at, responded_at,
  UNIQUE (contact_id, requested_channel_id)
```

One row per `(contact_id, requested_channel_id)`; re-asking creates a new row only if the
prior status is `declined`/`no_response` and the configured backoff period has elapsed.

RLS: same pattern as every other tenant-scoped table — `business_id` resolved via
`business_memberships`, policy shipped in the same migration that creates the table.

## Reminder engine channel-selection logic

When the reminder engine picks a channel to send on for a given contact:

1. Look up the contact's channel identities.
2. If a WhatsApp identity exists **and** `reminder_channel_consent.status = 'granted'` for
   that contact → send via WhatsApp (normal template-based path, unchanged).
3. Else if the contact's Instagram window is currently open (last inbound message within
   24h) → send via Instagram directly (no tag issue, it's inside the open window).
4. Else → do not attempt an automated send. Set `reminders.status = 'failed'` with
   `failure_reason = 'channel_unsupported'`, write an `activity_log` entry, and surface it
   in the "Needs Owner Attention" admin view for manual handling.

This keeps the reminder engine channel-agnostic in structure (the "one shared engine, zero
conditionals" rule) — the consent check and window check are just another data-driven
condition, not a vertical/channel branch in code.

## Testing additions (Launch Acceptance phase)

Add to the existing 6 vertical×channel + multi-channel + cross-vertical regression suite:

- Instagram contact, no WhatsApp consent, reminder due, window closed → reminder correctly
  fails to `channel_unsupported`, appears in admin queue.
- Instagram contact, consent granted, WhatsApp identity linked → reminder sends via
  WhatsApp template path.
- Instagram contact, consent declined → no further auto-asks until the configured backoff
  period elapses (`business_settings` value, not hardcoded).
- Kill switch (`automation_paused`) suppresses the consent-ask message itself, not just
  reminders — the ask is outbound automation too.

## Explicitly NOT built in this pass

- No automatic phone-number matching/merging between an Instagram identity and an existing
  WhatsApp contact record based on the number alone — the customer must go through the
  explicit consent flow.
- No renewed automated attempts on Instagram itself outside the open window under any tag —
  that path stays closed per Meta's current policy.
