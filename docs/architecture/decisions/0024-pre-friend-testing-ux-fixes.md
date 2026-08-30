# ADR-0024: Pre-Friend-Testing UX Fixes — Marketing Login Link, Dead CTA, Error/404 Pages

**Status:** Accepted (2026-08-30)

## Context

A full product/UX review ahead of Security Hardening (requested by the project owner,
covering marketing, the Get Started journey, first-time UX, mobile usability, and
friend-testing readiness) surfaced several concrete, approved-for-immediate-fix issues.
Each is small individually; grouped here as one ADR since they're all the same "make the
product presentable and functional for 2–3 trusted friends testing with fake data" pass.

## Decision

- **Marketing header now links to `/app/login`.** This reverses part of the Foundation
  hardening layer recorded in CLAUDE.md ("no links to `/app` from marketing pages"), which
  was written before any owner accounts existed to log into. The reversal is narrow: one
  plain "Log in" link, admin still gets zero links from marketing (that rule is untouched).
  This doesn't change the actual security boundary (RLS + auth) — it only changes whether a
  legitimate owner can find their own login page instead of needing the raw URL.
- **Marketing closing-CTA's two buttons no longer dead-loop.** They previously both
  `href="#start"` while already inside `id="start"` — clicking them did nothing. Changed to
  `mailto:hello@ordrfy.in` ("Request Early Access" / "Email us"), matching the project
  owner's explicit preference for manual, request-based onboarding over public self-signup.
  **`hello@ordrfy.in` is a placeholder** — no real inbox was confirmed to exist at that
  address; swap it for a real, monitored address before this is shown to anyone outside the
  project owner.
- **Added `error.tsx` and `not-found.tsx`** at the root, `app/app/`, and `app/admin/`
  levels, sharing one presentational component (`components/ui/StatusPage.tsx`). Verified
  the actual Next.js routing behavior live rather than assuming it: a fully-unmatched URL
  (no route exists at all) always renders the **root** not-found page; a nested
  `app/app/not-found.tsx` / `app/admin/not-found.tsx` only fires for an explicit
  `notFound()` call from within a page that *did* match (e.g., Contact Detail's invalid-id
  case) — both paths were exercised and confirmed correct, not just assumed from the docs.
  The error boundary was verified with a real thrown error via a temporary test route
  (deleted immediately after), confirmed to render the branded page instead of Next.js's
  default stack-trace overlay.
- **Today/Contacts List empty states now explain *why*.** "No contacts yet." became "No
  customer messages yet. Once WhatsApp or Instagram is connected, new chats will show up
  here automatically." (Today) and the equivalent for Contacts List — copy-only changes,
  no new component or logic.

## Alternatives Considered

- **Also link `/admin/login` from marketing.** Rejected — no legitimate public audience for
  that page; CLAUDE.md's existing rule stays exactly as-is there.
- **Route the marketing CTAs to a new "request access" form with its own backend/table.**
  Rejected per explicit instruction ("no new backend needed") — a `mailto:` is the smallest
  thing that is actually true (no fake promise of an automated flow that doesn't exist) and
  fits "manual onboarding" literally.

## Consequences

- The `hello@ordrfy.in` placeholder is a known gap, called out here so a future session (or
  the project owner) doesn't mistake it for a confirmed, monitored address.
- `NEXT_PUBLIC_SUPABASE_URL` pointing at `127.0.0.1:54321` (breaking Sign Out and admin MFA
  for anyone testing over a tunnel from a different machine) is a separate, larger decision
  the project owner is still weighing between two approaches — deliberately not resolved by
  this ADR; see `README.md`'s tunnel-testing section for the current state of that gap.
