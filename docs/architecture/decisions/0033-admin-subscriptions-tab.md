# ADR-0033: Admin Subscriptions Tab — Status Only, No Fabricated Amounts

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

**Deliberately shows no ₹ amount.** Fabricating a number here would be actively worse than
omitting it — an admin glancing at a real-looking rupee figure would reasonably assume it's
real. A one-line note under the page heading says plainly that pricing isn't finalized yet,
matching the marketing site's own "₹—" framing instead of contradicting it.

**Recommendation given, not yet built:** when asked how "amount" should work, proposed the
smallest real option — a manually-editable per-business monthly amount stored as a
`business_settings` row (that table already exists for exactly this kind of per-business
override; no new schema), letting the project owner track whatever's actually been agreed
per business today without waiting for a finalized company-wide price or a real Razorpay
integration. Not implemented pending the project owner's choice between that and a fuller
invoice-history table (see `docs/decisions-register.md`).

**Incidental fix while verifying live:** found a leftover test business
("Webhook Recovery Test ...") polluting the real business list — traced to
`scripts/verify-webhook-recovery.mjs`'s cleanup silently failing, since `webhook_events.
business_id` has no `ON DELETE CASCADE` (unlike `contacts`/`messages`/`reminders`/`payments`,
which all do) and the script's `finally` block never checked the delete's own error. Fixed by
deleting the business's `webhook_events` rows first and logging the cleanup error if the
business delete still fails. The stray row itself was removed from the database directly.

## Consequences

- No schema change in this ADR — the page reads only existing, real columns.
- The "what each business is paying" question remains genuinely open; tracked in
  `docs/decisions-register.md` pending the project owner's choice of approach.
- `scripts/verify-webhook-recovery.mjs` now cleans up completely on every run; re-ran it and
  `launch-acceptance-check.mjs` after the fix to confirm no stray data and no regression.
