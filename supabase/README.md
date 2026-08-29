# `supabase/`

Local Supabase stack config, migrations, and reference seed data. Everything here is what
`npm run db:reset` (or a fresh `npm run db:start`) applies, in CI exactly as in local dev —
`.github/workflows/ci.yml` runs the real Supabase CLI stack, not a mock.

## `migrations/` (29 files, `20260828120000`–`20260828120028`)

Chronological, never edited after the fact — a schema change is always a new migration.
Every table ships its RLS policy in the same migration that creates it (Non-Negotiable
Architecture Rule 3), never retrofitted in a later file.

The reasoning behind non-obvious migrations (the `verticals` reference table, the
append-only consent-history trigger, the Vault credential wrappers, the reminder-template
category guard, and others) lives in
[docs/architecture/decisions/](../docs/architecture/decisions/), not restated here — this
file is about *what exists*, the ADRs are about *why*.

Three triggers are worth knowing about before touching the tables they guard:
1. `contacts.pipeline_stage_id` guard — rejects cross-tenant/cross-vertical stage
   assignment, even from a bug in application code.
2. `reminders` insert/update guard — rejects attaching a non-`utility`-category WhatsApp
   template ([ADR-0002](../docs/architecture/decisions/0002-whatsapp-template-category-guard.md)).
3. `reminder_channel_consent` append-only guard — rejects any `UPDATE`/`DELETE` for every
   role, including `service_role`
   ([ADR-0003](../docs/architecture/decisions/0003-append-only-reminder-channel-consent.md)).

## `seed.sql` (414 lines)

Reference/config content only — `verticals`, `pipeline_stages`, `internal_reply_rules`,
`message_templates`, `opt_out_keywords` for all 5 verticals (Fashion, Tutor, Service,
Baker, Gift), all `active = true`. Applied on every `db reset`, including in CI.

**Never put demo/test data here.** Realistic dev-preview businesses (contacts, messages,
varied attention-queue states) live in `scripts/seed-dev-preview-data.mjs` instead,
specifically so a schema-focused `db reset` never has to carry fixture businesses along
with it, and so CI's SQL tests run against exactly the reference content a real deployment
would have — nothing more.

## `config.toml`

Local stack config — ports, auth settings (`site_url`/`additional_redirect_urls` point at
port 3100, matching this project's dev server; fixed 2026-08-29 after they were found still
pointing at the pre-port-change 3000), TOTP MFA enablement (`[auth.mfa.totp]` — off by
default in a fresh Supabase CLI install, found by actually testing enrollment in a browser,
not by reading the config). Changing any port here needs `.env.local` updated to match and
a full stack restart (`supabase stop && supabase start`) — config changes don't take effect
on a running stack.

**Not yet verified**: whether the default local ports (54321 API, 54322 DB, 54323 Studio,
54324 mail) collide with anything else on this machine, beyond the Next.js dev server port
(3100) which was already moved after a real collision. Tracked in
[docs/decisions-register.md](../docs/decisions-register.md).

## Local dev workflow

```bash
npm run db:start   # first time: creates + starts the stack, applies migrations + seed
npm run db:reset   # re-apply migrations + seed after a schema change
npm run db:stop    # stop the stack (data persists in a Docker volume)
npm run db:types   # regenerate lib/db/database.types.ts after a schema change
```
