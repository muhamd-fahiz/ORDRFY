# ADR-0034: Admin Dashboard Tab — Real Aggregates, Hand-Rolled Charts

**Status:** Accepted (2026-09-02)

## Context

The project owner asked for a dashboard-style admin tab showing "which is making more money,
which is making more customers," with a graphical/summary presentation, and explicitly said
this surface is allowed to look more professional/technical than the owner app (unlike the
owner app's non-technical-user simplicity mandate, ADR-0027).

## Decision

New `/admin/dashboard`, now the admin panel's actual landing page (`/admin`'s root redirect,
and every post-login/MFA redirect, moved here from `/admin/businesses`). Shows:

- A stat-card row: total businesses, active count, trial count, total customers (`contacts`
  count across all businesses), total order value tracked (`sum(payments.amount_paid)`), and
  unresolved `owner_attention_queue` count — all real, directly queried aggregates, no derived
  or estimated figures.
- A clearly-labeled note surfacing the total of the manually-set subscription amounts from
  ADR-0033, explicit that it is not a real invoice total.
- Two hand-rolled horizontal bar charts (`bar-list.tsx`, plain CSS width percentages, no
  charting library added): most customers by business, most order value by business — the
  literal "which is making more customers / more money" the project owner asked for, both
  built from data that already exists (`contacts`, `payments`), not fabricated.

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
- **Showing Ordrfy's own subscription revenue as the primary "money" metric.** Rejected as
  the primary chart — that number is still manually-typed (ADR-0033), not verified against
  any real payment. Order value (`payments.amount_paid`) is real, already-collected data
  flowing through each business, and a more honest "which business is actually using the
  product" signal today.

## Consequences

- All-existing-columns query, no schema change.
- The dashboard's numbers will be more meaningful once real (non-fixture) businesses and
  customers exist; today's aggregates include this session's own test/fixture data, which is
  expected, not a defect.
- Verified: typecheck, lint, production build all clean (route confirmed in the build's own
  route list); `launch-acceptance-check.mjs` re-run (14/14) to confirm no regression to the
  webhook/messaging paths untouched by this change.
