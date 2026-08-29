# ADR-0017: Owner Authentication Model — Admin-Provisioned Accounts, No Mandatory MFA

**Status:** Accepted (2026-08-29)
**Resolves:** CLAUDE.md known-blocker #10 ("there's currently no way to actually create the owner's login for them to sign in with").

## Context

A business could be created via the admin panel, but there was no way for its owner to actually sign in — no account, no login flow, no session-scoping mechanism. CLAUDE.md's non-negotiable Rule 3 (RLS-scoped multi-tenancy via `business_memberships` + `auth.uid()`) had never been exercised end-to-end for a real owner session; every prior read went through the service-role client instead, either from admin routes or from a temporary preview page built explicitly as a stand-in.

Two sub-decisions were made together, sharing the same underlying reasoning about how much security posture this surface actually needs:

## Decision 1: Provisioning is admin-initiated, not self-service or emailed

An admin, from the business detail page, creates the owner's login directly: `auth.users` row + `business_memberships` row (role `owner`) created together, with a randomly generated password shown to the admin **once**, to relay to the business owner out of band (phone/WhatsApp) — never emailed. This mirrors `scripts/create-admin.mjs`'s approach to bootstrapping an admin account, but triggered from the admin panel UI by an admin, not a developer with CLI/server access, since that's who actually needs to perform this action in practice.

**Alternatives considered:** Self-service signup — excluded outright, it's explicitly out of V1 scope on CLAUDE.md's "what NOT to build" list. An emailed invite link (Supabase Auth's built-in `inviteUserByEmail` flow) — rejected in favor of a phone/WhatsApp handoff, since these are WhatsApp-first micro-businesses; an email-based invite is a weaker bet that the owner will actually see and act on it than a direct handoff through the channel they already use daily.

## Decision 2: No mandatory MFA for owner sessions

Unlike `admin_users` (which requires TOTP MFA — `mfa_required boolean default true`), an owner session has no MFA requirement.

**Reasoning:** an owner session is RLS-scoped to exactly one business and can never reach another tenant's data, regardless of what the session does — the blast radius of a compromised owner credential is bounded to that one business. An admin session, by contrast, operates through the service-role client specifically to reach across every tenant, which is why it justifies the extra friction. The daily-use priority for the owner-facing surface (CLAUDE.md: "fast and low-friction... single-tap actions") also weighs against adding a step here that the admin surface's much higher blast radius justifies.

**Alternatives considered:** Requiring MFA for owners too, for uniform security posture across both auth surfaces. Rejected as disproportionate to the actual risk difference between the two account types, and in tension with the explicit low-friction design goal for this surface.

## Consequences

`lib/auth/owner-guard.ts` mirrors `lib/auth/admin-guard.ts`'s state-machine shape (`signed_out` / `no_membership` / `ready`) but has no MFA-related states, reflecting this decision directly in the type. Verified end-to-end with a real signed-in owner account: confirmed the RLS boundary holds not just for reads (a direct query for another business's contacts returns zero rows) but for writes too (see ADR-0019) — by directly querying with the owner's real access token, not by reasoning about the policy alone.
