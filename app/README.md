# `app/`

Next.js App Router. Three separate surfaces share this one tree — there is no route
group named for its purpose beyond the ones below; "frontend" here means all three
together, not one folder.

## Surfaces

### `(marketing)/` — public marketing site
One page, nine sections (`components/marketing/`), built 2026-08-30 from a Claude Design
handoff -- see [ADR-0022](../docs/architecture/decisions/0022-marketing-site-carbon-pink-extension.md)
for the token/logo decisions made integrating it. Content (verticals, FAQ) lives in
`lib/marketing/content.ts`, kept separate from components so it's a constants-module edit,
not a component edit, if it ever moves to a CMS. `app/(marketing)/layout.tsx` wires the same
font variables the other two surfaces use, same pattern as `app/admin/layout.tsx`.

### `admin/` — internal ops panel
Gated by `admin_users` membership + mandatory TOTP MFA (`lib/auth/admin-guard.ts`). Uses the
same Carbon Pink tokens/fonts/`components/ui/` library as the owner app (`app/admin/layout.tsx`
wires the font variables) — restyled 2026-08-30 per
[ADR-0021](../docs/architecture/decisions/0021-carbon-pink-extended-to-admin-panel.md),
reversing ADR-0016's original "admin stays functional-only, unstyled" call. Purely visual:
no functionality, route, or auth check changed. Reads/writes go through
`createServiceRoleClient()` after the guard verifies the caller, since an admin session needs
to reach every tenant's data, not just one.

- `admin/login/`, `admin/mfa/enroll/`, `admin/mfa/challenge/` — the sign-in state machine.
- `admin/(protected)/businesses/` — list, detail, create. The business detail page's
  "Create owner account" action (`create-owner-form.tsx`) is what actually provisions an
  owner login — see [ADR-0017](../docs/architecture/decisions/0017-owner-authentication-model.md).

### `app/` — the owner-facing app (yes, `app/app/`)
Gated by `business_memberships` + RLS (`lib/auth/owner-guard.ts`), **no mandatory MFA** —
a deliberate difference from the admin panel, reasoned through in ADR-0017. Reads/writes go
through `createRlsClient()` — every query is naturally scoped to the signed-in owner's own
business via Postgres RLS, never widened by application code.

- `app/login/` — sign-in.
- `app/(protected)/today/` — real data (contacts/pipeline-stage/`owner_attention_queue`),
  real mutations ("Review" resolves attention items, "Send Reminder" calls the actual Phase 2
  reminder engine) — see [ADR-0019](../docs/architecture/decisions/0019-today-view-mutation-design.md).
  Capped at `MAX_CONTACTS` most-recently-active contacts; `app/(protected)/attention/` exists
  specifically because that cap can hide an old unresolved item the count badge still counts.
- `app/(protected)/contacts/`, `app/(protected)/contacts/[id]/` — the full roster
  (stage-filterable) and per-contact detail (vertical fields, payments, pipeline stage
  changes via `stage-changer.tsx`).
- `app/(protected)/payments/` — business-wide payment list, status-filterable, with a
  Mark as Paid manual-reconciliation action (never automated billing — see CLAUDE.md's V1 scope).
- `app/(protected)/settings/` — owner-editable `businesses` profile fields (name/phone/
  email/timezone/preferred_language) only. Deliberately does **not** expose the other
  `business_settings` keys CLAUDE.md documents (reminder timing, instant-ack, digest
  frequency) — none of them have any consuming code in the shared engine yet, so a control
  for them would have no real effect. See `docs/decisions-register.md`.

### `design-preview/` — component-library showcase, not a real screen
Static demo content, no data fetching. Useful for checking a component in isolation; not
part of the product.

## `api/`

- `admin/login/`, `app/login/` — rate-limited password sign-in for each surface
  (`lib/rate-limit/`), separate buckets so one surface's login attempts can't exhaust the
  other's budget.
- `admin/forgot-password/`, `app/forgot-password/` — rate-limited password-reset requests
  (ADR-0025), own named buckets per surface. Always returns the same generic response
  regardless of whether the email matches an account -- never branch this on Supabase's
  actual result, that's the anti-enumeration property `resetPasswordForEmail()` itself relies on.
- `admin/businesses/[id]/create-owner/` — provisions an owner account (ADR-0017).
- `app/attention/resolve/`, `app/reminders/send-now/` — the Today view's real mutations
  (ADR-0019).
- `app/contacts/[id]/stage/` — pipeline stage changes, guarded by the `guard_contact_pipeline_stage` trigger as a second, independent layer beyond RLS.
- `app/payments/[id]/mark-paid/` — manual payment reconciliation (never automated billing).
- `app/settings/` — owner business-profile edits (see `app/(protected)/settings/` above);
  the only mutation route here that never takes a target id — it always writes the caller's
  own `businessId` from the session, so there's no cross-tenant id to guard against.
- `cron/reminders/` — the scheduled reminder-engine tick, invoked by `pg_cron`/`pg_net`
  with a shared secret (`CRON_INTERNAL_SECRET`).
- `webhooks/whatsapp/`, `webhooks/instagram/` — inbound message intake. Verify signature →
  durably store → ack 200 → then process (Non-Negotiable Architecture Rule 4); never ack
  before the durable write.

**Route-handler auth pattern:** every route above checks session state with
`getAdminSessionState()`/`getOwnerSessionState()` directly and returns a plain
`NextResponse.json({...}, { status: 401 })` when not ready — never the redirect-based
`requireReady*Session()` variants, which are for Server Components/layouts only. See
[ADR-0018](../docs/architecture/decisions/0018-route-handler-session-checks.md) for why
that distinction is load-bearing, not stylistic.

## Root files

- `layout.tsx` — the root layout. Deliberately minimal (no fonts, no design tokens) — each
  surface wires the Carbon Pink design system itself via its own layout instead
  (`app/admin/layout.tsx`, `app/app/(protected)/layout.tsx`, `app/design-preview/layout.tsx`),
  since the marketing site at this route's own level still has no design direction yet.
- `robots.ts` — host-aware: disallows `/admin` and `/app` on the shared host today, will
  disallow everything once `admin.`/`app.` become real separate hosts. Defense in depth
  only — the actual security boundary is the auth guards above, never "the URL is hidden."
