# ADR-0034: Admin Dashboard Tab — Ordrfy's Own Customers Only, By Vertical

**Status:** Accepted (2026-09-02)

## Context

The project owner asked for a dashboard-style admin tab showing "which is making more money,
which is making more customers," with a graphical/summary presentation, and explicitly said
this surface is allowed to look more professional/technical than the owner app (unlike the
owner app's non-technical-user simplicity mandate, ADR-0027).

**Corrected once already, same session, before this settled:** the first version answered
"which business has more customers/order value" using `contacts` and `payments` — but those
tables are a *business's own end-customers'* data, not Ordrfy's. The project owner corrected
this directly: "my customers" means the businesses themselves (Ordrfy's own customers), and
the real question was *by vertical*, not by individual business. This ADR describes the
corrected, final design — the `contacts`/`payments`-based version never shipped as the
intended design, only as an immediately-caught mistake within the same work item.

## Decision

New `/admin/dashboard`, now the admin panel's actual landing page (`/admin`'s root redirect,
and every post-login/MFA redirect, moved here from `/admin/businesses`). Shows:

- A stat-card row: total businesses, active count, trial count, and total subscription
  revenue (sum of the manually-set amounts from ADR-0033) — every figure here comes from
  `businesses` and `business_settings` only, never `contacts`/`messages`/`payments`.
- Two hand-rolled horizontal bar charts (`bar-list.tsx`, plain CSS width percentages, no
  charting library added), both grouped **by vertical**, reading `verticals` (ADR-0009) for
  the label set rather than a hardcoded list: "Businesses by vertical" (which vertical has
  more of Ordrfy's own customers) and "Subscription revenue by vertical" (which vertical is
  generating more of the manually-tracked revenue) — the literal two questions asked,
  answered with data Ordrfy actually owns the relationship for.

No new schema. No new dependency — a bar chart at this scale doesn't need one, and adding a
charting library for two lists would be exactly the over-engineering this project's standing
instructions call out.

**Landing page change:** every place that redirected to `/admin/businesses` after a
successful sign-in or MFA step (login, MFA challenge, MFA enrollment) now redirects to
`/admin/dashboard` instead, plus the 404 page's recovery link — consistent single "home."
`/admin/businesses` itself is unchanged and still reachable from the nav; only the
post-auth/error landing target moved.

## Alternatives Considered

- **A real charting library** (recharts, chart.js, etc.). Rejected — two simple ranked lists
  don't need one; CSS-width bars are visually sufficient and keep the bundle and dependency
  surface unchanged.
- **Per-business ranking instead of per-vertical.** Rejected per the project owner's explicit
  correction — the actual question asked both times was about verticals, not individual
  businesses.
- **Any use of `contacts`/`messages`/`payments` on this page.** Rejected outright after the
  correction — those tables describe a business's *own* customers, which this page must never
  surface in aggregate or otherwise, per the same "my customers means the businesses, not
  their customers" boundary already established for the Subscriptions tab (ADR-0033).

## Consequences

- All-existing-columns query, no schema change.
- The dashboard's numbers will be more meaningful once real (non-fixture) businesses exist
  across more than one per vertical; today's aggregates include this session's own
  test/fixture data, which is expected, not a defect.
- This ADR's own correction is a useful marker: any *future* admin-panel metric must be
  checked against the same question before building — is this about Ordrfy's relationship
  to the business, or the business's relationship to their own customer? Only the former
  belongs on pages framed around "my customers."
- Verified: typecheck, lint, production build all clean (route confirmed in the build's own
  route list); `launch-acceptance-check.mjs` re-run (14/14) to confirm no regression to the
  webhook/messaging paths untouched by this change.
