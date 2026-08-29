# `lib/`

Shared logic, organized by concern rather than by which surface (`admin`, owner `app`,
marketing) uses it — nothing here should ever branch on vertical or channel (Non-Negotiable
Architecture Rule 1); differences live in data (`pipeline_stages`, `internal_reply_rules`,
`vertical_field_definitions`) or in the adapter pattern below.

## `db/`

`server.ts` exports two clients — knowing which to reach for is the single most
important thing to get right in this codebase:

- `createRlsClient()` — cookie-based, subject to every RLS policy. The **only** client an
  owner-facing request should ever use. Every table's tenant-isolation policy resolves
  `business_id` live via `business_memberships` + `auth.uid()`, never a static claim.
- `createServiceRoleClient()` — bypasses RLS entirely. Reserved for: admin routes (after
  `admin-guard.ts` has verified the caller), and webhook/cron routes, which run as trusted
  server code with no per-request user session to scope to. Throws if ever imported into
  client-side code.

`browser.ts` — the client-side equivalent of `createRlsClient()`, for use in Client
Components (currently just sign-out buttons).

`database.types.ts` — generated (`npm run db:types`), never hand-edited.

## `auth/`

`admin-guard.ts` / `owner-guard.ts` — each exposes a `get*SessionState()` (a plain,
non-redirecting state read) and a `requireReady*Session()` (redirects on anything but a
fully-ready session). The redirecting variant is for Server Components/layouts only —
route handlers under `app/api/` must call the non-redirecting variant directly and return
their own `NextResponse`, or a signed-out `fetch()` caller gets a followed redirect instead
of a clean 401. See [ADR-0018](../docs/architecture/decisions/0018-route-handler-session-checks.md).

Admin sessions require TOTP MFA; owner sessions deliberately don't — see
[ADR-0017](../docs/architecture/decisions/0017-owner-authentication-model.md) for why that
asymmetry is intentional, not an oversight.

## `engine/` — the shared engine

Every file here is channel- and vertical-agnostic by construction:

- `webhook-durability.ts` — store-before-ack, idempotent on `(provider, provider_event_id)`.
- `contact-resolution.ts` — resolves or creates a contact from `(channel, provider_user_id)`.
- `automation-matching.ts` — keyword-priority matching against `internal_reply_rules`,
  with an explicit `ambiguous` outcome on a priority tie (never guesses).
- `automation.ts` — orchestrates one inbound message end to end: opt-out check → kill-switch
  check → trial-eligibility check → keyword match → auto-reply or attention-queue entry.
- `channel-selection.ts` — pure function deciding WhatsApp vs. Instagram vs. unsupported for
  a reminder, per [ADR-0001](../docs/architecture/decisions/0001-instagram-whatsapp-consent-routing.md).
  Unit-tested (`tests/unit/channel-selection.test.ts`).
- `reminders.ts` — `runReminderEngineOnce()`, the actual scheduler tick: recovers stuck
  reminders, claims due ones via `FOR UPDATE SKIP LOCKED`, sends, retries with backoff on
  failure. Called both by `pg_cron` (via `/api/cron/reminders`) and directly, in-process,
  by the owner app's "Send Reminder" action (ADR-0019) — same function, same guarantees,
  either caller.
- `kill-switch.ts`, `trial-eligibility.ts`, `pipeline.ts`, `business-resolution.ts` — the
  remaining send-eligibility and pipeline-stage primitives.

## `channels/` and `payments/` — the adapter pattern

`types.ts` defines `MessagingChannelProvider`/`PaymentProvider`; `factory.ts` in each
folder is the only place a caller should ever obtain one (`WHATSAPP_PROVIDER`/
`INSTAGRAM_PROVIDER`/`PAYMENT_PROVIDER` env vars select mock vs. real). Only mock
implementations exist today — `MockWhatsAppProvider`, `MockInstagramProvider`,
`MockPaymentProvider`. A real `InteraktAdapter`/`InstagramProvider` is Build Phase 4 and
must satisfy the same interface with zero changes to any caller.

## `secrets/`

`vault.ts` — the sole application-level access point for Supabase Vault-backed provider
credentials (`store/get/update/deleteProviderCredential`). Never log or write a resolved
value anywhere. See [ADR-0015](../docs/architecture/decisions/0015-vault-backed-credentials.md).

## `rate-limit/`

Pluggable (`types.ts`), in-memory locally (`memory.ts`), swaps to Upstash automatically
once `UPSTASH_REDIS_REST_URL`/`TOKEN` are set (`upstash.ts`), selected by `factory.ts`.
Used by both login routes with separate named buckets per surface.

## `design/` and `data/`

`design/fonts.ts`, `design/verticals.ts`, `design/format-time.ts` — the Carbon Pink design
system's non-visual pieces (font loading, the vertical→icon/color lookup table, a
relative-time formatter). See [ADR-0016](../docs/architecture/decisions/0016-carbon-pink-design-tokens.md)
for the token system itself (`tailwind.config.ts`) and `components/ui/` for the components
that consume it.

`data/today.ts` — the Today view's query layer. Takes an already-authenticated
`createRlsClient()` instance and a `businessId` resolved by `owner-guard.ts` — it has no
opinion about *how* the caller got authorized, only about what to query once they are.
