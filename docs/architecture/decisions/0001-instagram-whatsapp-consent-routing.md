# ADR-0001: Instagram Reminders Route Through WhatsApp via Customer-Confirmed Consent

**Status:** Accepted (2026-08-28)
**Supersedes:** The original "window-check + Needs Owner Attention fallback" resolution recorded against CLAUDE.md known-blocker #4 (no automated Instagram-only reminders, manual follow-up only).

## Context

Instagram's Messaging API cannot send automated business-initiated messages (fee due, payment due, appointment reminder) once a customer's 24-hour messaging window has closed. The message tags that used to allow this (`CONFIRMED_EVENT_UPDATE`, `ACCOUNT_UPDATE`, `POST_PURCHASE_UPDATE`) were deprecated by Meta on April 27, 2026. The remaining Human Agent tag only permits manually-typed messages from a real person — using it for automated sends is a policy violation Meta actively detects. This is a hard platform constraint, confirmed against Meta's own developer docs, not a design gap Ordrfy can work around.

WhatsApp has the same underlying "no messaging outside consent" constraint, but solves it with pre-approved templates — which still require the customer to be reachable on WhatsApp in the first place.

The originally-recorded resolution to this (window-check against `last_inbound_at`, falling back to "Needs Owner Attention" for manual follow-up when the window is closed) left every Instagram-only business with a closed window unable to receive any automated reminder at all — a materially worse outcome than necessary.

## Decision

Route Instagram customers' reminders through WhatsApp instead, with explicit, customer-confirmed consent captured once in-chat, rather than only falling back to manual owner follow-up.

**Consent flow** (bot-initiated, within an open Instagram window only):
1. Bot asks for WhatsApp opt-in at one of two trigger points (config-driven per business): onboarding (first meaningful interaction with a new Instagram contact), or just-in-time (right before the first reminder would otherwise be due, if no consent has been captured yet). Exact copy is vertical-configurable, not hardcoded.
2. Customer replies with consent + a phone number, or declines.
3. On consent: store the number as a new `contact_channel_identities` row (`channel_id = whatsapp`) on the *same* contact — no merge, no new contact record. `provider_metadata` records `{ "linked_via": "instagram_consent_flow", "consented_at": "<timestamp>" }`.
4. On decline / no response: contact stays Instagram-only. Reminders that would have gone automated instead get logged and surfaced for manual owner follow-up.

**Reminder-engine channel selection** (see also ADR-0006 for the `owner_attention_queue` this ultimately feeds):
1. WhatsApp identity exists **and** current consent status is `granted` → send via WhatsApp (normal template path).
2. Else, Instagram window is currently open (`last_inbound_at` within 24h) → send via Instagram directly.
3. Else → `reminders.status = 'failed'`, `failure_reason = 'channel_unsupported'`, logged to `activity_log`, surfaced in `owner_attention_queue`.

New table `reminder_channel_consent` (`supabase/migrations/20260828120019_reminder_channel_consent.sql`) tracks consent state — see ADR-0003 for why it's append-only rather than a single mutable row per contact/channel.

## Alternatives Considered

- **Keep the original window-check-only resolution.** Rejected: leaves a strictly worse outcome (no automated reminder path at all for a closed-window Instagram-only contact) than the consent-routing alternative achieves for the same contact.
- **System-inferred merge of an Instagram contact with an existing WhatsApp contact based on phone number alone.** Rejected — this is exactly the "auto-merge across channels" Non-Negotiable Architecture Rule 2 excludes from V1. The customer explicitly confirming the link themselves in-chat is different in kind: a customer-confirmed link, not a system inference. This exception does not depend on or unblock the separate V1.5 auto-merge feature — the two must never be conflated when reasoning about Rule 2.
- **Renewed automated Instagram attempts under some other tag once the window closes.** Not available — Meta's current policy leaves no compliant tag for this use case.

## Consequences

Instagram-only businesses that never consent to WhatsApp contact, and whose Instagram window is closed at send time, still don't get an automated reminder in V1 — that residual case fails to `channel_unsupported` for manual follow-up. This is a smaller gap than the original resolution left, not a fully eliminated one; Meta's platform constraint is still real and cannot be designed around.

No automatic phone-number matching/merging between an Instagram identity and an existing WhatsApp contact based on the number alone is built — the customer must go through the explicit consent flow every time.

## Testing Added (Launch Acceptance phase)

- Instagram contact, no WhatsApp consent, reminder due, window closed → reminder correctly fails to `channel_unsupported`, appears in the attention queue.
- Instagram contact, consent granted, WhatsApp identity linked → reminder sends via the WhatsApp template path.
- Instagram contact, consent declined → no further automated asks until the configured backoff period elapses (`business_settings` value, not hardcoded).
- Kill switch (`automation_paused`) suppresses the consent-ask message itself, not just reminders — the ask is outbound automation too.
