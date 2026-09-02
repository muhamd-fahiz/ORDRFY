# ADR-0029: Cross-Tenant Integrity Fixes (Pre-Security-Hardening Blockers)

**Status:** Accepted (2026-09-02)

## Context

An independent read-only audit found two potential critical cross-tenant issues. A separate,
independent verification pass (read-only, no changes) confirmed both from the actual source
code and database definitions:

1. **Global reminder engine reached from a per-tenant action.** `POST /api/app/reminders/
   send-now` called `runReminderEngineOnce()` with no scoping — the same unscoped function
   the cron job calls, which drains the entire global due-reminder queue across every
   business via `claim_next_reminder()` (no `business_id` parameter at all). One owner's
   manual "Send Reminder" tap could therefore claim and send another business's already-due
   reminder too, as an incidental side effect.
2. **No cross-tenant contact/business integrity guard.** `contact_channel_identities`,
   `messages`, `reminders`, and `payments` all carry both `business_id` and `contact_id`, but
   nothing — not RLS (which only checks the row's own `business_id`), not a composite FK, not
   any existing trigger — verified that `contact_id` actually belongs to the stated
   `business_id`. Directly exploitable via a raw PostgREST/Supabase-js call (bypassing the
   Next.js app entirely) by anyone holding a valid authenticated session — including, most
   realistically, one person who legitimately owns two separate Ordrfy businesses. Combined
   with finding 1, this meant a reminder engine run could resolve a real customer's
   `provider_user_id` on behalf of a business that isn't actually theirs, and the automation
   eligibility check (kill switch, trial status) was keyed to the *attacker's* stated
   `business_id`, not the real contact-owning business — so the target's own kill switch gave
   no protection.

The project owner explicitly scoped this work to fixing only these two confirmed issues,
before formal Security Hardening begins — not a broader hardening pass, and not any other
finding from the same audit (webhook idempotency, provider-account uniqueness, timezone
handling, etc.), which are deferred for individual review later.

## Decision

**Fix 1 — contact/business integrity, enforced at the database:**
`supabase/migrations/20260902000001_contact_business_integrity_guard.sql` adds one trigger
function, `guard_contact_business_match()`, applied via a `before insert or update of
contact_id, business_id` trigger on each of the four tables. It looks up the referenced
contact's actual `business_id` and raises an exception if it doesn't match the row's own —
mirroring the exact pattern already established by `trg_guard_contact_pipeline_stage`
(20260828120018). This closes the gap at the root, for every write path at once (the Next.js
app's own routes, any future write path, and a direct PostgREST call alike), regardless of
role — the same reasoning that trigger's own comment already states: a database-level guard
protects against an application bug too, not just a malicious caller.

**Fix 1, defense-in-depth:** `lib/engine/reminders.ts`'s `processReminder()` now filters its
`contact_channel_identities` lookups and `resolveProviderUserId()` by `business_id` in
addition to `contact_id`. The migration above is the primary fix (it prevents a mismatched row
from ever existing); this is the second, independent layer, in case any future write path
were to bypass it.

**Fix 2 — the manual trigger no longer drains the global queue:**
`runReminderEngineOnce()` gained an optional `{ onlyReminderId }` parameter. When set, it
claims and processes exactly that one reminder (a plain conditional `UPDATE ... WHERE
status='pending' ... RETURNING`, which is already atomic on its own — `FOR UPDATE SKIP
LOCKED`'s extra behavior only matters when choosing among many candidates, which a
single-target claim doesn't need). `app/api/app/reminders/send-now/route.ts` now calls it
with `{ onlyReminderId: inserted.id }`. The cron path
(`app/api/cron/reminders/route.ts`, called with no argument) is completely unchanged and
still drains the full global queue every 5 minutes, exactly as before.

## Alternatives Considered

- **Decoupling "insert" from "process now" entirely** for the manual path (enqueue and let
  the next cron tick handle it). Rejected — changes the owner-facing UX (no more immediate
  outcome on the tap), which wasn't part of the two confirmed findings and wasn't asked for.
- **A composite foreign key** (`(contact_id, business_id) references contacts(id,
  business_id)`) instead of a trigger. Not pursued: `contacts.id` is already the sole primary
  key referenced from many places; changing it to a composite key or adding a redundant unique
  constraint on `(id, business_id)` to support a composite FK is a larger schema change than a
  trigger mirroring an already-proven pattern, for the same guarantee.
- **Restricting `resolveProviderUserId`/identity lookups by business_id only (skip the DB
  trigger).** Rejected — that's app-layer only, and per this project's own repeated stated
  design ("RLS is the actual boundary, not app code"), a database-level guard is the primary
  defense; the app-layer filter is deliberately kept as a secondary layer, not a substitute.

## Consequences

- Both fixes are small and isolated: one migration (one function, four triggers), a two-line
  filter addition in one existing function, an optional parameter on one existing function,
  and its one call site.
- New regression coverage: `tests/sql/006_contact_business_integrity_guard.sql` (mirrors
  `002_pipeline_stage_guard.sql`'s exact style — raw Postgres role, proving the trigger fires
  regardless of RLS) proves all four tables reject a cross-tenant `contact_id` on both INSERT
  and UPDATE, and still allow a same-tenant one. `scripts/verify-reminder-send-now-scoping.mjs`
  (mirrors `launch-acceptance-check.mjs`'s "test through the real route" convention) proves,
  through the real `/api/app/reminders/send-now` route with a real session, that a manual
  trigger processes only its own reminder and leaves a separately-seeded, already-due
  reminder belonging to another business completely untouched. Both were run, plus the full
  existing regression suite (`test:sql` 6/6, `vitest` 25/25, `launch-acceptance-check.mjs`
  14/14, typecheck, lint, production build) — all green, confirming no regression to
  legitimate same-business reminder processing or the cron path's global behavior.
- Deliberately not touched, per explicit scope: webhook idempotency, provider-account
  uniqueness, Hindi automation content, network-error handling, the manual-reminder timezone
  question, and every other item from the same audit — tracked separately for individual
  review before the formal Security Hardening phase begins.
