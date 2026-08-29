# ADR-0021: Extend Carbon Pink to the Admin Panel

**Status:** Accepted (2026-08-30)

## Context

[ADR-0016](0016-carbon-pink-design-tokens.md) built the Carbon Pink design system for the
owner app and deliberately namespaced it away from the admin panel's own `brand`/`status`
tokens, on the reasoning that CLAUDE.md's "what NOT to build in V1" list excludes a "polished
admin UI (functional only)" — restyling it was explicitly rejected as an alternative in that
ADR.

Now that the owner app has a full design identity across every screen (Today, Contacts,
Contact Detail, Needs Attention, Payments) and the admin panel is the only surface left
rendering in the browser's default font with plain gray/teal styling, the project owner
decided the whole product should look like one product, not two. This is a direct,
explicit reversal of the "admin stays untouched" call in ADR-0016 — not a reinterpretation
of it, and not a scope change to what the admin panel *does*.

## Decision

Restyle every `/admin/*` page with the existing Carbon Pink tokens, fonts, and component
library — no new tokens, no new components, and no functional changes:

- `tailwind.config.ts`: the admin panel's `brand`/`status` color tokens are **deleted**, not
  kept alongside Carbon Pink's tokens. Once every admin page is restyled, nothing references
  them — per the project's own structure discipline ("when something becomes obsolete,
  delete it, don't leave it sitting around 'just in case'"), they don't stay as dead config.
- `app/admin/layout.tsx` (new): wraps every `/admin/*` route (login, MFA enroll/challenge,
  and the protected businesses section) in `ordrfyFontVariables` plus `bg-paper font-app
  text-ink`, the same pattern already used by `app/app/(protected)/layout.tsx` and
  `app/design-preview/layout.tsx`. One shared wrapper, not one per page.
- Every admin page/component swaps `neutral-*`/`brand`/`status-*` Tailwind classes for
  `ink`/`paper`/`pink`/`confirmed`/`attention` and `font-display`/`font-app`/`font-data`,
  and reuses `components/ui/Button` and `components/ui/Chip` directly (a submit button
  inside a Server Action `<form>` is still a plain `<button type="submit">`, so `Button`
  drops in with no wiring changes) rather than inventing admin-specific variants.
- **Explicitly out of scope, per the project owner's own framing**: MFA enrollment/challenge
  flow, `admin_users` gating, rate limiting, and every other security/functional behavior are
  untouched. This ADR only ever touches `className` strings and font wrapper components —
  no route logic, no query, no auth check was edited to make this change.

## Alternatives Considered

- **Keep the admin panel unstyled, per ADR-0016's original reasoning.** This was correct
  at the time (V1 scope explicitly excluded a "polished admin UI"), but the project owner
  revisited it once the owner app's design was fully built out — visual inconsistency
  between the two surfaces became the more visible cost. Superseding a prior decision on
  new information/priorities is a legitimate change-control trigger, not scope creep.
- **Keep both token sets defined, unused `brand`/`status` included, in case admin styling is
  ever reverted again.** Rejected — the project's own structure discipline calls for deleting
  obsolete config rather than hedging against a hypothetical future reversal. If a future
  session needs the old teal/gray look back, `git log` on `tailwind.config.ts` has it.

## Consequences

- One design system, one component library, one font set for the entire product surface —
  no more "which token set does this page use" question when touching either app or admin.
- `/design-preview`'s own layout comment (which asserted "/admin/* pages are untouched by the
  Carbon Pink design system") needed updating — a small but real reminder that a claim like
  that, once written down, needs to be revisited whenever the thing it's describing changes.
- Verified live against the local dev server, in a real signed-in admin session, not just by
  reading the diff: login form styling, MFA enrollment (QR code + verify), MFA challenge,
  businesses list (including the "deleted" and kill-switch-paused `Chip` states), business
  detail, new-business form submission, and the create-owner-account success panel. Confirmed
  the admin login → MFA → businesses flow still functions end-to-end after the restyle — this
  was a visual-only change, and that claim was checked, not assumed.
