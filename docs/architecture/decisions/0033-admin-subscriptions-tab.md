# ADR-0033: Admin Subscriptions Tab — Status Plus a Manually-Set Amount

**Status:** Accepted (2026-09-02)

## Context

The project owner asked for a "Subscriptions" admin tab showing active/cancelled status and
"what each is paying" across all businesses, "like a best compact simple thing." Checked
directly before building anything: `business_entitlements` and `pricing_plans` are both
completely empty in this database (zero rows in either), and the marketing site's own
Pricing section still shows `₹—` placeholders for all three plans — there is no real
subscription amount anywhere in this product yet, for any business.

## Decision

Built `/admin/subscriptions`: one table across **all** businesses regardless of vertical
(deliberately the one admin view that does *not* split by vertical, unlike
`/admin/businesses` — billing status is a cross-cutting question, not a per-vertical one),
showing business name, vertical, `subscription_status` (as a colored `Chip`: active=confirmed,
trial=neutral, inactive=attention), and `trial_ends_at`. A status-filter chip row and a
vertical-filter chip row (both showing live counts, mirroring the Contacts List's existing
filter-chip pattern) plus a name search sit above the table, added once it was pointed out
this needs to stay usable as the business count grows.

**Amount is manually-set, not fabricated or automated.** When asked how "amount" should
work, proposed the smallest real option — a per-business monthly amount stored as a
`business_settings` row (that table already exists for exactly this kind of per-business
override; no new schema) — and the project owner confirmed: build this now, build the fuller
real thing later. `AmountCell` (a small click-to-edit component, same single-row-action shape
as `PaymentActions`/`StageChanger` elsewhere in this codebase) shows `formatRupees(amount)`
or "Not set", and edits go through a new `POST /api/admin/businesses/[id]/subscription-
amount` route (admin-session-gated, writes via service-role, logs to `activity_log`). This is
explicitly what the project owner is manually agreeing per business today — not a real
invoice, not anything that charges anyone, and not tied to `pricing_plans` (which stays
empty). A one-line note under the page heading says plainly that this isn't a real invoice
history, so a future reader doesn't mistake a manually-typed number for billing data.

**Deferred, not built:** a real invoice-history table (`subscription_invoices`: one row per
billing period, `amount`/`status`/`due_date`/`paid_at`), which would give a real timeline and
accurate totals instead of one static number. Discussed directly with the project owner —
explicitly deferred until real pricing and real billing collection exist (around Phase 6's
Razorpay integration), since building it now would mean rows with no real amounts behind
them, the same underlying gap just spread across more schema. Tracked in
`docs/decisions-register.md`.

**Incidental fix while verifying live:** found a leftover test business
("Webhook Recovery Test ...") polluting the real business list — traced to
`scripts/verify-webhook-recovery.mjs`'s cleanup silently failing, since `webhook_events.
business_id` has no `ON DELETE CASCADE` (unlike `contacts`/`messages`/`reminders`/`payments`,
which all do) and the script's `finally` block never checked the delete's own error. Fixed by
deleting the business's `webhook_events` rows first and logging the cleanup error if the
business delete still fails. The stray row itself was removed from the database directly.

## Consequences

- No schema change — `business_settings` already existed for exactly this shape of
  per-business override.
- The manually-set amount can drift from reality (nobody's forced to keep it updated, and
  nothing reconciles it against an actual payment) — an accepted tradeoff of the "simple now,
  real later" sequencing, not an oversight.
- The real invoice-history version remains a deliberately open, later decision; tracked in
  `docs/decisions-register.md`.
- `scripts/verify-webhook-recovery.mjs` now cleans up completely on every run; re-ran it and
  `launch-acceptance-check.mjs` after the fix to confirm no stray data and no regression.
- Verified: typecheck, lint, production build all clean; the upsert-on-conflict pattern the
  new route relies on was directly exercised against the real schema before shipping.
