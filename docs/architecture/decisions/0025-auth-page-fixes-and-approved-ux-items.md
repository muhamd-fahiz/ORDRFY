# ADR-0025: Auth Page Fixes, Password Reset, and the Second Round of Approved UX Items

**Status:** Accepted (2026-08-30)

## Context

The project owner tested the login pages directly in their own browser (not this session's
automation) and found real defects the earlier browser-based testing had missed: the login
form rendered visibly off-center at a real desktop width, neither login page showed the
Ordrfy logo, and there was no password-recovery path at all. Separately, the second
product/UX review round approved several more items: a Mark-as-Paid success confirmation, a
minimal loading state, and building contact search now rather than deferring it.

## Decision

**Auth page layout and branding:**
- Root-caused the off-center layout: both login pages centered their content with `mx-auto`
  on the inner block alone, relying on flex auto-margins rather than `items-center` on the
  flex container. This reproduced *some* centering in this session's own testing but was
  visibly wrong in the project owner's real browser at a real desktop width — the flex
  auto-margin approach is less robust than explicit cross-axis alignment. Fixed by
  introducing `components/ui/AuthPageShell.tsx`, a shared shell (self-contained font wiring,
  the `Logo` lockup, `items-center` centering, a `Copyright` line) used by every
  unauthenticated auth page instead of six near-duplicate inline layouts.
- Neither login page previously rendered the `Logo` component at all — both now do, closing
  a real branding gap the project owner's screenshots made obvious.

**Password reset, built end-to-end for both surfaces:**
- `POST /api/app/forgot-password` and `/api/admin/forgot-password`: rate-limited (own named
  buckets, coarser than login's since a reset request is rarer legitimate traffic but still
  triggers a real outbound email), and **always return the same generic response regardless
  of whether the email matches an account** — matching Supabase's own anti-enumeration
  design for `resetPasswordForEmail()`, not undone by this route branching on its result.
- `/app/reset-password` and `/admin/reset-password`: the actual password-setting step,
  gated on a real recovery session established by the emailed link (confirmed via
  `onAuthStateChange`'s `PASSWORD_RECOVERY` event and a `getSession()` fallback for the case
  where that event fired before the listener attached). Uses a three-state model
  (`checking`/`ready`/`invalid`) specifically to avoid a real bug caught during
  implementation: a naive boolean "ready" flag flashed the "invalid link" message on every
  legitimate visit while the async session check was still in flight.
- `supabase/config.toml`'s `additional_redirect_urls` extended to include both
  `127.0.0.1:3100` and `localhost:3100` variants of the reset-password pages — required for
  Supabase to accept the `redirectTo` at all; local Supabase was restarted for this to take
  effect (a config.toml change, not a migration, needs a restart, not a `db reset`).

**Verified live, not assumed:** the complete flow was run for real — submitted a reset
request, read the actual email from the local Mailpit catcher (confirming the email really
sends and the `redirect_to` in the link matches what was just added to
`additional_redirect_urls`), followed the real verify link, set a new password, and signed
in again with it to confirm the new password actually took effect. The fixture account's
password was restored to the documented dev credential afterward.

**Copyright:** `components/ui/Copyright.tsx` (year computed, never hardcoded), added to the
owner-app footer, admin footer, marketing footer (alongside the existing "ORDRFY.IN · MADE
IN INDIA" line, not replacing it), and both surfaces' `AuthPageShell`.

**Mark-as-Paid confirmation:** `PaymentActions` now shows "Marked as paid." for ~900ms
before `router.refresh()` re-renders the card — closing the one genuinely-silent high-stakes
action identified in the prior UX review.

**Minimal loading state:** `components/ui/PageLoading.tsx` (a centered spinner, deliberately
not a per-screen skeleton) wired as `loading.tsx` for `app/app/` and `app/admin/`.

**Contact search:** `getContactsList()` now also fetches `phone_number`/`display_handle`
from `contact_channel_identities` and exposes a lowercased `searchText` per contact.
`ContactsList` adds a plain substring search input, combined with the existing stage filter
(both apply together; stage-chip counts reflect the current search too, only the stage
selection itself is excluded from that pass). This is a filter over an array already fully
loaded client-side — the same mechanism the stage chips already used — not the dedicated
full-text/universal search system CLAUDE.md's "what NOT to build" list excludes.

## Alternatives Considered

- **Investigate the off-center bug by trying to reproduce it pixel-for-pixel first.**
  Rejected as the first step — the fix (explicit `items-center`) is strictly more robust
  than the previous mechanism regardless of the exact cause, and correctly reproducing a
  browser-specific rendering discrepancy would have cost more than just fixing it properly.
- **Skip the three-state `checking`/`ready`/`invalid` model on the reset-password form and
  ship the simpler boolean.** Caught as wrong during implementation, before shipping, not
  after — the boolean version would show "this link is invalid" to every real visitor for
  the brief window before the async session check resolves.

## Consequences

- Six near-duplicate auth-page layouts collapsed into one shared shell — a future visual
  change to the auth-page chrome (logo size, spacing, copyright placement) happens once.
- The password-reset flow is a genuinely new, security-relevant surface (unauthenticated
  routes that end in a password change) landing right before Security Hardening — worth
  that phase paying specific attention to (rate-limit behavior under load, token handling,
  the anti-enumeration property) rather than assuming this ADR's local testing is sufficient
  on its own.
