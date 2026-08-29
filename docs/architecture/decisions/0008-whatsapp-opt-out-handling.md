# ADR-0008: Detect and Honor WhatsApp Opt-Outs Automatically

**Status:** Accepted (2026-08-28)

## Context

A customer who has asked to stop receiving messages must actually stop receiving them — both as a matter of customer trust and, in India, as a matter of DPDP Act consent-withdrawal expectations. Without an explicit mechanism, an opt-out request typed into a normal WhatsApp conversation could be missed entirely, since it looks like any other inbound message to naive keyword matching.

## Decision

- `contact_channel_identities.opted_out_at` (nullable, per-channel) — opting out on WhatsApp doesn't imply opting out on Instagram too, since they're separate channel identities on the same contact.
- `opt_out_keywords` table: business-overridable (nullable `business_id` = global default), language-aware phrase list, seeded with common English + Hindi phrases at launch.

## Alternatives Considered

- **A single account-level opt-out flag.** Rejected — opting out is inherently per-channel; a customer might reasonably want WhatsApp messages stopped while still messaging on Instagram.

## Consequences

Deferred to Build Phase 2: the actual detection logic, checked against every inbound message *before* `internal_reply_rules` matching — an opt-out always wins over any other automation match, never a secondary check. `opted_out_at` folds into the reminder engine's send-eligibility check as one more data-driven condition alongside the WhatsApp-consent and Instagram-window checks from ADR-0001, never a separate code path. On detection: set `opted_out_at`, log to `activity_log` so the owner understands why sends silently stopped rather than assuming a bug.
