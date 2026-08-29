# ADR-0015: Supabase Vault-Backed `credentials_ref`, With Two Real Bugs Found and Fixed

**Status:** Accepted and verified (2026-08-28), during Build Phase 1 (admin panel).

## Context

`business_channel_connections.credentials_ref` must never resolve to a raw WhatsApp/Instagram provider token stored in plain text. This request was explicitly verification-heavy — "confirm, don't assume" — rather than a request to design something new from scratch.

**Background verification, not a decision in itself:** encryption-at-rest (AES-256, "all customer data," on all plans, cannot be disabled) and TLS-in-transit for the HTTP APIs (PostgREST, Auth, Storage) this app actually talks to via `supabase-js` were confirmed against Supabase's current official docs, not carried forward unverified from the original planning set. One real nuance surfaced that wasn't previously flagged anywhere: direct raw Postgres wire connections (port 5432/6543 on a hosted project) do **not** enforce SSL by default — it's off for client compatibility and must be explicitly turned on via the Supabase dashboard/CLI/Management API. This doesn't affect Ordrfy today since nothing in the codebase opens a raw Postgres connection; every access path goes through the HTTPS REST API via `supabase-js`. Action item for the Hardening pass / pre-launch checklist: if a future phase (e.g. a connection-pooling need) ever adds a raw `pg`/`postgres.js` connection, SSL enforcement must be explicitly enabled on the hosted project first.

## Decision

Confirmed, not assumed, against this project's actual local Postgres image before committing to the approach: the `supabase_vault` extension is installed by default; create/read/update/delete were all tested manually against a real secret before writing any application code; the access boundary was tested directly — `anon`/`authenticated` roles get an explicit `permission denied for schema vault`, only `service_role` can read `vault.decrypted_secrets`.

Built: SECURITY DEFINER wrapper functions (`store_provider_credential`, `get_provider_credential`, `update_provider_credential`, `delete_provider_credential`, `get_secret_id_by_name` — `supabase/migrations/20260828120026_credential_vault_functions.sql`), since the `vault` schema itself isn't exposed through PostgREST and application code (even using the service-role client) only ever reaches Postgres through PostgREST. `lib/secrets/vault.ts` is the sole application-level access point.

**Rule enforced going forward:** `credentials_ref` stores a Vault secret id only, never a raw token. Never log, `console.log`, or write a resolved credential value anywhere (`activity_log` included).

## Alternatives Considered

- **App-level encryption with the key stored outside the database.** Not pursued once Supabase Vault was confirmed available and working end-to-end on this project's actual Postgres image — Vault is the platform-native mechanism and avoids Ordrfy needing to manage its own encryption key lifecycle.

## Bugs Found During Implementation

Both found by actually calling the functions as each role and checking the real result, not by reading the SQL and assuming it worked:

1. **Grant leak.** `revoke execute ... from public` alone left `anon` and `authenticated` able to call `store_provider_credential` successfully. Root cause: Supabase's platform setup applies a default ACL on the `public` schema (`pg_default_acl`) that grants `EXECUTE` on every new function directly to `anon`, `authenticated`, and `service_role` — not through the `PUBLIC` pseudo-role, so revoking from `public` doesn't touch it. Fixed by revoking from the actual role names (`revoke ... from public, anon, authenticated`), then re-verified both roles get an explicit `permission denied for function` and `service_role` still works.
2. **NOT NULL violation.** `vault.secrets.description` is `NOT NULL DEFAULT ''`, but the wrapper's `p_description text default null` passed an explicit `NULL` through when the caller omitted it, which violates the constraint — a column default only applies when the column is omitted from the INSERT, not when NULL is passed explicitly. Fixed with `coalesce(p_description, '')` inside the wrapper.

Both fixes were verified with a full re-run: `anon`/`authenticated` denied, `service_role` succeeds through a complete create → read → update → delete round trip.

## Consequences

`messages.content` remains explicitly unencrypted end-to-end — no change from the original design. The pipeline engine needs to read message text for keyword matching and to show chat history to the business owner, the same way any business messaging platform (Intercom, Zendesk, etc.) works. Recorded here only to close the loop on the request, not because anything changed.
