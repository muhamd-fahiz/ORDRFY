# ADR-0023: Launch Acceptance Verified via Real Webhook Payloads, Not Fixture Inserts

**Status:** Accepted (2026-08-30)

## Context

ADR-0020 requires all 10 vertical×channel combinations tested end-to-end against the mock
providers before real provider integration begins. Every screen/workflow built so far
(Today through Settings) was verified against data inserted directly into Postgres by
`scripts/seed-dev-preview-data.mjs` — realistic, but never exercised through the actual
inbound path (`POST /api/webhooks/{whatsapp,instagram}` → durability → `processInboundMessage()`)
a real customer message takes. Launch Acceptance is specifically the pass that closes that
gap, so it had to run through the real webhook routes, not add more fixture rows.

Doing that surfaced two real, previously-undiscovered gaps before a single test could even
run:

1. **No business anywhere had a `business_channel_connections` row.** Neither
   `supabase/seed.sql` nor `scripts/seed-dev-preview-data.mjs` ever created one, and the
   admin panel has no "connect a channel" action (deliberately deferred to Build Phase 6 per
   ADR-0012). `resolveBusinessIdFromProviderAccount()` — the very first thing either webhook
   route does after durably storing the event — depends entirely on this table. Every
   webhook test would have failed at that lookup, for every business, on every previous
   day of this build.
2. **Nothing ever populated `contacts.name`.** `MockWhatsAppWebhookPayload.displayName` was
   defined on the interface but never read; `NormalizedInboundMessage` had no `displayName`
   field at all; `contact-resolution.ts`'s contact-creation insert never set `name`. Every
   contact created by the real pipeline — as opposed to a fixture script that sets `name`
   directly in SQL — would show as "Unnamed contact" forever, in every screen, for every
   real customer.

Neither gap was visible in any previous testing this build, because every previous
verification pass used hand-seeded contacts that already had `name` set and never touched
`business_channel_connections` at all.

## Decision

- **Fixed both gaps before testing, not after.** `NormalizedInboundMessage` gained a
  `displayName: string | null` field; both mock providers populate it (WhatsApp from the
  payload's `displayName` — matching the real WhatsApp Business API's
  `contacts[].profile.name` field per the mock-fidelity discipline, ADR-0020; Instagram
  reuses `displayHandle`, since Instagram's real Messaging webhook has no separate name
  field and inventing one would violate that same discipline). `contact-resolution.ts` now
  sets `contacts.name` from it on first contact only — never overwritten on a returning
  contact's later messages.
- **`scripts/seed-dev-preview-data.mjs` now seeds `business_channel_connections`** (both
  channels, `connected: true`) for every fixture business, with a deterministic
  `provider_account_id` (`dev-{wa,ig}-{businessId}`) a test script can address directly.
  Also extended the script to cover **all 5 verticals**, not 3 — Tutor (`Bright Minds
  Tuitions`) and Gift (`Wrapped With Love`) were the two missing from the original 3
  (fashion/baker/service), needed here since Launch Acceptance is explicitly a 5-vertical
  requirement.
- **`scripts/launch-acceptance-check.mjs`** (new, permanent, re-runnable) posts real
  payloads at both webhook routes and asserts against real Postgres state for 14 scenarios:
  all 10 vertical×channel combinations (one real seeded `internal_reply_rules` keyword
  each, confirming contact creation, initial pipeline stage, `contacts.name`, and the
  correct auto-reply), a cross-vertical regression check (a baker-only keyword sent to the
  fashion business must **not** match), a genuinely-unmatched message via the real webhook
  path (not a fixture insert), an opt-out keyword end-to-end, and a multi-channel check
  that the same "person" messaging on both channels produces two separate contacts, never
  auto-merged (Non-Negotiable Architecture Rule 2).
- **Not building the admin-panel "connect a channel" UI.** ADR-0012 already deferred it to
  Build Phase 6 for a real reason (it doesn't matter which mock-vs-real backend a UI screen
  targets until the real backend exists) — Launch Acceptance doesn't need that UI to exist,
  since seeding `business_channel_connections` directly is exactly how a service-role
  fixture script is supposed to establish state that a not-yet-built admin action would
  otherwise create.

## Alternatives Considered

- **Test the pipeline logic directly (call `processInboundMessage()` from a script), skip
  the HTTP layer.** Rejected — this is specifically the pass meant to prove the *webhook*
  path (signature check → durable store → ack → process), which is exactly the part every
  previous verification pass skipped by writing straight to Postgres.
- **Leave `contacts.name` unfixed and treat "Unnamed contact" as expected Launch Acceptance
  output.** Rejected the moment it was traced to its root cause — this isn't a documented
  V1 limitation anywhere, it's an unfinished wire-up (a field defined and never connected),
  and shipping 14 passing tests that all show "Unnamed contact" would misrepresent what
  Launch Acceptance actually verified.

## Consequences

- `scripts/launch-acceptance-check.mjs` is safe to re-run any time (fresh random
  `provider_user_id` per run) and should be re-run whenever `internal_reply_rules`,
  `contact-resolution.ts`, or either webhook route changes — it now exists as a permanent
  regression check, not a one-off script deleted after use.
- 14/14 scenarios passed on the run this ADR records, verified against real Postgres state,
  then cross-checked live in the owner app itself (Contacts List, Needs Attention) to
  confirm the data renders exactly as the pipeline produced it — not just correct in the
  database, but correct on screen. Fixture data was restored to its clean baseline
  afterward via a normal re-run of `seed-dev-preview-data.mjs`.
- The reminder engine's channel-selection logic (WhatsApp-consent → Instagram-window →
  `channel_unsupported`) and the owner-app mutation screens (Send Reminder, Mark as Paid,
  Review) were already verified in earlier sessions against fixture data — this pass
  intentionally did not duplicate that, since its actual gap was specifically the inbound
  webhook path.
