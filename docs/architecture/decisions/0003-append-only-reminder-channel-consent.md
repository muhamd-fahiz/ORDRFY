# ADR-0003: `reminder_channel_consent` Is Append-Only, Enforced by Trigger for Every Role

**Status:** Accepted (2026-08-28)

## Context

Ordrfy stores customer phone numbers, chat history, and — per ADR-0001 — WhatsApp-messaging consent captured via Instagram. India's DPDP Act requires businesses to be able to demonstrate valid consent for processing personal data. If a customer later disputes being messaged, the business needs a durable, tamper-evident record of what was agreed and when — a single mutable "current consent status" column cannot provide that.

## Decision

`reminder_channel_consent` is append-only: a status change (e.g. `granted` → `revoked`) inserts a **new** row referencing the same `contact_id` + `requested_channel_id`; existing rows are never updated. A trigger (`reject_reminder_channel_consent_mutation`, firing `before update or delete`) rejects any `UPDATE`/`DELETE` outright, for every role including `service_role` — triggers fire regardless of RLS bypass, so this is a real guarantee, not just an RLS gap that a service-role caller could route around. A superuser can temporarily disable the trigger for a genuine data-correction need.

"Current" consent state is derived via `current_reminder_channel_consent`, a view selecting the most recent row per `(contact_id, requested_channel_id)` — the same pattern already used for `activity_log`-style event logs.

## Alternatives Considered

- **`UNIQUE (contact_id, requested_channel_id)` constraint with in-place status updates** (the originally suggested implementation). Rejected: a unique constraint on the identifying columns makes it structurally impossible to ever insert a second consent event for the same contact/channel — directly contradicting "append-only history." Built without that constraint.

## Bugs Found During Implementation

**Cross-tenant RLS bypass via the view, caught before it shipped.** A view created by a migration (a superuser-like role) without `security_invoker = true` executes with the *owner's* privileges by default, which silently bypasses RLS on the underlying table for every caller — exactly the cross-tenant leak this project's own hardening tests exist to catch. `current_reminder_channel_consent` is built `with (security_invoker = true)` so it respects the querying user's RLS policies as if they queried `reminder_channel_consent` directly. This was self-caught during migration review, not discovered via a failing test, but is recorded here as a bug because the leak would have been real had it shipped.

## Consequences

Deleting a business's data (e.g. cleaning up test fixtures) requires temporarily disabling the append-only trigger — confirmed as correct, expected friction, not a bug to route around silently.
