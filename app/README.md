# `app/`

Next.js App Router. Three separate surfaces share this one tree — there is no route
group named for its purpose beyond the ones below; "frontend" here means all three
together, not one folder.

## Surfaces

### `(marketing)/` — public marketing site
Placeholder only (`page.tsx` is the unmodified scaffold). Not started as real work.

### `admin/` — internal ops panel
Gated by `admin_users` membership + mandatory TOTP MFA (`lib/auth/admin-guard.ts`).
Deliberately **functional-only, never polished** — see CLAUDE.md's "what NOT to build in
V1" list. Reads/writes go through `createServiceRoleClient()` after the guard verifies the
caller, since an admin session needs to reach every tenant's data, not just one.

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
- `app/(protected)/today/` — the one real screen built so far. Real data
  (contacts/pipeline-stage/`owner_attention_queue`), real mutations ("Review" resolves
  attention items, "Send Reminder" calls the actual Phase 2 reminder engine) — see
  [ADR-0019](../docs/architecture/decisions/0019-today-view-mutation-design.md).

### `design-preview/` — component-library showcase, not a real screen
Static demo content, no data fetching. Useful for checking a component in isolation; not
part of the product.

## `api/`

- `admin/login/`, `app/login/` — rate-limited password sign-in for each surface
  (`lib/rate-limit/`), separate buckets so one surface's login attempts can't exhaust the
  other's budget.
- `admin/businesses/[id]/create-owner/` — provisions an owner account (ADR-0017).
- `app/attention/resolve/`, `app/reminders/send-now/` — the Today view's real mutations
  (ADR-0019).
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

- `layout.tsx` — the root layout. Deliberately minimal (no fonts, no design tokens) — the
  Carbon Pink design system is scoped to `app/(protected)/` and `design-preview/` via their
  own layouts, never applied here, so the admin panel stays visually untouched.
- `robots.ts` — host-aware: disallows `/admin` and `/app` on the shared host today, will
  disallow everything once `admin.`/`app.` become real separate hosts. Defense in depth
  only — the actual security boundary is the auth guards above, never "the URL is hidden."
