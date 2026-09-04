# ADR-0040: Self-Service Signup and Shared Provisioning Core

**Status:** Accepted (2026-09-05)

## Context

Ordrfy had exactly one way for a business to come into existence: an admin, from the admin
panel, creates the `businesses` row and later creates the owner's login (ADR-0017). A
customer-journey audit (2026-09-04) found this was the *only* path — there was no signup
route, no onboarding wizard, and no self-service way for a business owner to reach the
product on their own. Several rounds of architecture review (2026-09-04 through 2026-09-05)
worked through the resulting design questions: how to avoid creating a full tenant for every
abandoned signup attempt ("ghost tenants"), how to keep self-service and admin-assisted
provisioning from becoming two divergent code paths, how routing should behave for an
authenticated user who isn't a ready owner yet, and how an admin account must never be
mistakenly nudged into creating a business under its own identity. This ADR documents the
architecture as actually implemented across five build phases, not the original proposal —
several details (see Consequences) were corrected during implementation and a live-testing
hardening pass.

## Decision

### Deferred provisioning via `signup_drafts`

No `businesses`/`business_memberships` row is created when someone merely signs up.
`signup_drafts` (`supabase/migrations/20260904000001_signup_drafts.sql`) holds all pre-tenant
onboarding state: identity fields, the free-text business description, the detected
vertical/confidence, and a `structured_answers` jsonb bag for everything the wizard collects.
RLS is `user_id = auth.uid()`, the same shape as `business_memberships`' own
`members_see_own_memberships` policy — there is no `business_id` to scope by yet. A partial
unique index (`idx_signup_drafts_one_active_per_user`, `where status = 'in_progress'`)
enforces one active draft per user; `getOrCreateActiveDraft()`
(`lib/data/onboarding-draft.ts`) finds-or-creates it on every visit to `/onboarding`, so
there is no separate "start onboarding" action. This is what prevents ghost tenants: an
abandoned signup only ever leaves behind a cheap, isolated draft row, never a half-formed
production business.

### Atomic ProvisioningCore, shared by both paths

`provision_business()` (`supabase/migrations/20260904000003_provisioning_core_functions.sql`)
is the one function that creates a business: it writes `businesses`, optionally
`business_memberships` (nullable `p_owner_user_id` — the admin path creates a business with
no owner yet, added later by the existing `create-owner` flow), default `business_settings`
(`trial_grace_period_days`), default `business_entitlements` (`channel:whatsapp`,
`channel:instagram`), an optional `business_knowledge_profiles` row, and an `activity_log`
entry — all in one transaction. `finish_onboarding(p_draft_id)` is the self-service-specific
wrapper around it: it locks the draft row (`for update`), and only self-service calls ever
pass a knowledge profile. `lib/provisioning/provision-business.ts` is the single TypeScript
call site either path is allowed to use — `app/api/app/onboarding/finish/route.ts`
(self-service) and `app/admin/(protected)/businesses/new/actions.ts` (admin, retrofitted in
Phase 1) both go through it. This closes a real, pre-existing gap: neither path had ever
written default `business_settings`/`business_entitlements` before this work.

### Idempotent completion

`finish_onboarding()`'s row lock plus a `status = 'completed'` check means a retried or
double-clicked finish request returns the already-provisioned business instead of erroring
or creating a duplicate. `provisioned_business_id` on the draft is the idempotency anchor.
Verified twice: once at the SQL level (`tests/sql/013_provisioning_core.sql`, two sequential
calls to `finish_onboarding()` in one test transaction) and once live, through the real
browser and the real `POST /api/app/onboarding/finish` route — two genuinely overlapping
requests, both returning `200 OK`, with exactly one business/membership/knowledge-profile
row confirmed in the database afterward.

### Draft expiry

`expire_stale_signup_drafts()` (`supabase/migrations/20260904000004_expire_stale_signup_drafts.sql`)
runs daily via `pg_cron`, deleting `in_progress` drafts past their 14-day `expires_at`. It is
a plain SQL `DELETE` with no `pg_net`/Vault hop, unlike the reminder engine's cron tick —
there is no application logic to invoke, just a row to remove, and a draft holds no committed
customer data, so ADR-0011's "no automated hard-delete" reasoning (about real customer PII)
does not apply here.

### Owner routing states

`lib/auth/owner-guard.ts`'s `OwnerSessionState` has five states, resolved in this order:
`signed_out` → `ready` (a real `business_memberships` row exists) → `no_membership_admin_account`
(a positive `admin_users` identity check — the same table/policy `admin-guard.ts` already
trusts) → `no_membership_has_draft` → `no_membership_no_draft`. `requireReadyOwnerSession()`
(the `/app/**` protected-layout guard) and `app/onboarding/layout.tsx` (the onboarding guard)
both consume this state and must agree: a `ready` session is turned away from `/onboarding`,
a `no_membership_admin_account` session is turned away from *both* surfaces (signed out,
redirected with an error), and the two ordinary no-membership states are allowed into
`/onboarding`, where `getOrCreateActiveDraft()` transparently creates a fresh draft if none
exists.

### The admin-account distinction — corrected during Phase 5 hardening

The original design had a single `no_membership` state, inherited from ADR-0017, that
signed the session out unconditionally. This conflated two populations that need opposite
treatment: a legitimate account with nothing yet — a fresh self-service signup, or a
returning owner whose draft expired after 14 days — is eligible to start or resume
onboarding; an admin account with no owner membership (e.g. an admin who authenticated
through the owner-facing login form by mistake) must never be routed there, since that could
nudge them into creating a stray business under their own identity. The fix is a positive
identity check against `admin_users`, not a heuristic, checked before the draft lookup so it
takes priority regardless of draft state. A gap found during this same hardening pass: the
`/onboarding` layout guard had no case at all for this state, meaning an already-authenticated
admin navigating there directly (bypassing the login route's own check entirely) fell through
to rendering the wizard. Both the login route and the onboarding layout now agree. Verified
live: a real admin account tested against both entry points — the owner login form (inline
error, not routed to onboarding) and direct navigation to `/onboarding` while authenticated
(signed out and redirected, closing the gap).

### Provisioning stays server/service-role only

Every autosave write to `signup_drafts` goes through the RLS-scoped client
(`app/api/app/onboarding/draft/route.ts`) — an ordinary per-user write RLS already covers.
Provisioning itself — `provision_business()`/`finish_onboarding()`, both revoked from
`anon`/`authenticated` and granted only to `service_role` — is only ever reached through
`lib/provisioning/provision-business.ts`, called from trusted server routes that have already
authenticated the caller and resolved *their own* draft id server-side (never a client-supplied
one, for the self-service finish route). This mirrors the "no client-side privileged
provisioning" boundary the existing `create-owner` route already established.

## Alternatives Considered

- **Creating the `businesses` row immediately at signup.** Rejected — this is exactly the
  ghost-tenant problem the deferred-provisioning design exists to avoid.
- **A separate provisioning implementation for self-service, alongside the existing admin
  path.** Rejected in favor of retrofitting the admin path onto the same
  `provision_business()` core — otherwise the two paths would silently diverge in what a
  "fully provisioned" business actually has (this had already happened once, by omission,
  before this work: neither path wrote default settings/entitlements).
- **A new lifecycle/status column on `businesses`** to represent "provisioned but knowledge
  incomplete." Rejected — the only real incompleteness a provisioned business can have is an
  admin-created business with no `business_knowledge_profiles` row yet, which is already a
  plain nullable one-to-one relationship, not a state machine.
- **Signing out and erroring on every no-membership case** (the original, ADR-0017-inherited
  behavior). Rejected during Phase 5 hardening in favor of the positive admin-account check
  above, once it was clear this was blocking legitimate returning users, not just catching
  anomalies.

## Consequences

- New tables: `signup_drafts`, `business_knowledge_profiles`. New functions:
  `provision_business()`, `finish_onboarding()`, `expire_stale_signup_drafts()`. New routes:
  `/app/signup`, `/app/signup/confirmed`, `/onboarding`, `/api/app/signup`,
  `/api/app/onboarding/draft`, `/api/app/onboarding/finish`.
- **Not built in this work, despite earlier architecture discussion**: a "complete your
  business profile" nudge for admin-created owners with no knowledge profile. The routing and
  schema do not block adding it later (`hasKnowledgeProfile` is a trivial computed check), but
  no UI for it exists yet — an admin-created business today simply has no
  `business_knowledge_profiles` row, with nothing prompting the owner to fill one in. Tracked
  as a real gap, not implemented speculatively.
- **A real concurrency bug was found and fixed via live testing, not design review**:
  `getOrCreateActiveDraft()`'s select-then-insert was not atomic; a concurrent call (two tabs,
  or a double-firing redirect) could hit the partial unique index and throw an unhandled
  `23505` instead of gracefully returning the winner's row. Fixed by catching that specific
  error code and re-selecting.
- No AI, no real WhatsApp/Instagram integration, no catalog/billing work was touched or
  introduced by this ADR — see ADR-0041 for the deterministic knowledge engine this
  provisioning core's self-service path feeds into.
