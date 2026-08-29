# Ordrfy

Multi-tenant WhatsApp/Instagram business assistant SaaS for Indian micro-businesses.
Tagline: "Chats in. Orders out."

- [CLAUDE.md](./CLAUDE.md) — the full reconciled architecture reference (schema, precedence
  order, build order, known blockers). Read this first.
- [docs/architecture/decisions/](./docs/architecture/decisions/) — one file per significant
  technical decision: what was decided, why, alternatives considered, bugs found.
- [docs/decisions-register.md](./docs/decisions-register.md) — open business decisions still
  needing the project owner's input.
- [app/README.md](./app/README.md), [lib/README.md](./lib/README.md),
  [supabase/README.md](./supabase/README.md) — what's actually built in each part of the
  codebase, kept current, not aspirational.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Install Docker Desktop** and make sure it's running — local Supabase dev
   (Postgres + Auth + RLS, entirely local and free) depends on it.

3. **Start the local Supabase stack**

   ```bash
   npm run db:start
   ```

   This prints a local API URL, anon key, and service-role key. Copy `.env.example` to
   `.env.local` and fill them in.

4. **Apply migrations + seed data** (happens automatically on a fresh `db:start`; re-run
   after a schema change):

   ```bash
   npm run db:reset
   ```

5. **Run the app**

   ```bash
   npm run dev
   ```

   Runs on port **3100**, not the Next.js default 3000 — another project on this machine
   already uses 3000. `npm run start` uses the same port.

6. **(Optional) Seed realistic dev-preview data** for the owner app — three businesses
   across different verticals with varied contacts and attention-queue states:

   ```bash
   node scripts/seed-dev-preview-data.mjs
   ```

   Deliberately separate from `supabase/seed.sql` (which is reference/config content, not
   demo data) and safe to re-run — see the script's header comment for one real gotcha
   around owner accounts created against its fixture businesses.

## Current status (2026-08-29)

Verified means actually tested against the live local stack — real browser sessions, real
`psql` checks, real signed-in accounts — not just "the code was written."

- ✅ **Foundation** — schema + RLS migrations, admin panel (`admin_users`-gated login, TOTP
  MFA enrollment/challenge), owner authentication (`/app`, RLS-scoped, admin-provisioned
  accounts, no mandatory MFA — see [ADR-0017](./docs/architecture/decisions/0017-owner-authentication-model.md))
- ✅ **Shared engine** — pipeline/automation matching, reminder scheduler (`pg_cron`+`pg_net`,
  real cron tick confirmed reaching the app end-to-end), webhook durability, kill switch
- ✅ **Vertical configuration** — real `pipeline_stages`/`internal_reply_rules`/
  `message_templates` content for all 5 verticals (Fashion, Tutor, Service, Baker, Gift)
- ✅ **Owner app, in progress** — Carbon Pink design system
  ([ADR-0016](./docs/architecture/decisions/0016-carbon-pink-design-tokens.md), extended to
  the admin panel too —
  [ADR-0021](./docs/architecture/decisions/0021-carbon-pink-extended-to-admin-panel.md)), a
  small component library (`components/ui/`), real screens (Today, Contacts List, Contact
  Detail, Needs Attention, Payments, Settings) with real mutations (stage changes, "Review"/
  "Send Reminder", Mark as Paid, business-profile edits —
  [ADR-0019](./docs/architecture/decisions/0019-today-view-mutation-design.md))
- ✅ **CI** — every push runs the full local Supabase stack, RLS/trigger SQL tests, unit
  tests, typecheck, lint, and build (`.github/workflows/ci.yml`)
- ⬜ **Owner app, remaining workflows** — all core screens exist now; Settings is
  deliberately scoped to real `businesses` profile fields only, since the other documented
  `business_settings` keys (reminder timing, instant-ack, digest frequency) have no engine
  consumer yet — see `docs/decisions-register.md`
- ⬜ **Launch acceptance, mock-verified** — all 10 vertical×channel combinations tested
  end-to-end against the mock providers, deliberately *before* any real provider work
  ([ADR-0020](./docs/architecture/decisions/0020-mock-verified-before-real-providers.md))
- ⬜ **Security hardening pass** — full automated test suite from the Hardening Addendum
- ⬜ **Real provider integration, deliberately last** — Interakt (WhatsApp), Instagram
  Graph API — still mock providers only (`WHATSAPP_PROVIDER=mock`,
  `INSTAGRAM_PROVIDER=mock`, `PAYMENT_PROVIDER=mock` in `.env.example`); nothing touches a
  real WhatsApp number, a real Instagram account, or real money yet. Meta Business/Instagram
  verification is running in parallel now regardless, since its review timeline is external
  and unpredictable.

Two open decisions are tracked in
[docs/decisions-register.md](./docs/decisions-register.md), not silently assumed either way.
