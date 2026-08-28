# Ordrfy Addendum — Encryption & Credentials Hardening

**Status: ACCEPTED AND VERIFIED (2026-08-28), during Build Phase 1 (admin panel).** Read
alongside CLAUDE.md. This addendum was verification-heavy by request — "confirm, don't
assume" — and two real bugs were found and fixed while doing that, not just a paper review.

## 1. Encryption at rest and TLS in transit

**Confirmed against Supabase's current official docs** (not carried forward unverified from
the original planning set):
- Encryption at rest: AES-256, "all customer data," on all plans, cannot be disabled
  ([Supabase Security](https://supabase.com/security)).
- HTTP APIs (PostgREST, Auth, Storage) — which is everything this app actually talks to via
  `supabase-js` — automatically enforce TLS on all incoming connections, always.

**One real nuance surfaced, not previously flagged in any planning doc**: direct raw
Postgres wire connections (port 5432/6543 on a hosted project) do **not** enforce SSL by
default — it's off for client compatibility and must be explicitly turned on via the
Supabase dashboard/CLI/Management API
([SSL Enforcement docs](https://supabase.com/docs/guides/platform/ssl-enforcement)). This
doesn't affect Ordrfy today — nothing in the codebase opens a raw Postgres connection;
every access path goes through the HTTPS REST API via `supabase-js`. **Action item for the
Hardening pass / pre-launch checklist**: if a future phase (e.g. a connection-pooling need
per the Scaling Plan) ever adds a raw `pg`/`postgres.js` connection, SSL enforcement must be
explicitly enabled on the hosted project first — it is not the default.

Local dev serves everything over plain HTTP on `127.0.0.1` loopback-only — expected and
correct, not a gap. There's no network exposure to protect against, and "mirror production
behavior" doesn't reasonably extend to requiring self-signed certs for a local Docker
Postgres that never leaves the machine.

## 2. `business_channel_connections.credentials_ref` — Supabase Vault, verified end-to-end

**Confirmed, not assumed, against this project's actual local Postgres image** before
committing to the approach:
- `supabase_vault` extension is installed by default (checked `pg_available_extensions`).
- Create/read/update/delete all tested manually against a real secret before writing any
  application code.
- Access boundary tested directly: `anon` and `authenticated` roles get an explicit
  `permission denied for schema vault`; only `service_role` can read
  `vault.decrypted_secrets`.

**Built**: SECURITY DEFINER wrapper functions (`store_provider_credential`,
`get_provider_credential`, `update_provider_credential`, `delete_provider_credential` —
`supabase/migrations/20260828120026_credential_vault_functions.sql`), since the `vault`
schema itself isn't exposed through PostgREST and application code (even using the
service-role client) only ever reaches Postgres through PostgREST. `lib/secrets/vault.ts`
is the sole application-level access point.

**Two real bugs found while validating this migration, not just written and trusted:**

1. **Grant leak.** `revoke execute ... from public` alone left `anon` and `authenticated`
   able to call `store_provider_credential` successfully — confirmed by actually calling it
   as those roles, not by reading the grant statement and assuming it worked. Root cause:
   Supabase's platform setup applies a default ACL on the `public` schema
   (`pg_default_acl`) that grants `EXECUTE` on every new function directly to `anon`,
   `authenticated`, and `service_role` — not through the `PUBLIC` pseudo-role, so revoking
   from `public` doesn't touch it. Fixed by revoking from the actual role names
   (`revoke ... from public, anon, authenticated`), then re-verified both roles get an
   explicit `permission denied for function` and `service_role` still works.
2. **NOT NULL violation.** `vault.secrets.description` is `NOT NULL DEFAULT ''`, but the
   wrapper's `p_description text default null` passed an explicit `NULL` through when the
   caller omitted it, which violates the constraint (a default only applies when the column
   is omitted from the INSERT, not when NULL is passed explicitly). Fixed with
   `coalesce(p_description, '')` inside the wrapper.

Both fixes were verified with a full re-run: `anon`/`authenticated` denied, `service_role`
succeeds through a complete create → read → update → delete round trip.

**Rule enforced going forward**: `credentials_ref` stores a Vault secret id only, never a
raw token. Never log, `console.log`, or write a resolved credential value anywhere
(`activity_log` included) — stated on the function comment and in `lib/secrets/vault.ts`'s
module doc so Build Phase 4 (real provider integration, where this actually gets used)
inherits the constraint rather than rediscovering it.

## 3. `messages.content` — explicitly unchanged

No end-to-end encryption of customer message content. The pipeline engine needs to read
message text for keyword matching and to show chat history to the business owner, the same
way any business messaging platform (Intercom, Zendesk, etc.) works. This was already the
design — recorded here only to close the loop on the request, not because anything changed.
