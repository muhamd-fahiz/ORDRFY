# ADR-0032: Admin Panel Desktop Scale-Up, Per-Vertical Dashboards, Settings

**Status:** Accepted (2026-09-02)

## Context

The project owner reviewed the admin panel directly and asked for several related
improvements in one session: better desktop *and* mobile layout (the admin panel had been
deliberately left desktop-only/functional-only, per CLAUDE.md's original "what NOT to build"
note), a way to see each vertical's businesses separately instead of one long mixed list, a
real Settings screen (password change, profile, MFA management), and — after an initial pass
still looked too small on a real wide desktop monitor — a more decisive typography/spacing
scale-up.

One item was corrected mid-implementation: "invoice/payment details" was initially built as
the *business's own customers'* payment records (the `payments` table), then explicitly
corrected — the project owner wants each business's subscription payment to Ordrfy, not their
customers' payments, which has no schema anywhere yet. That correction is **not** implemented
here; see `docs/decisions-register.md`.

## Decision

**Responsive fixes:** every table (`businesses` list, per-vertical list, channel-connections
table) is wrapped in `overflow-x-auto` with a `min-w-[...]` on the table itself, so a narrow
viewport scrolls the table horizontally instead of breaking the page layout. The business
detail page's info `<dl>` uses `grid-cols-[auto_1fr]` (label beside value, not stacked) so it
stays compact at any width instead of the earlier `grid-cols-1 sm:grid-cols-2` approach.

**Per-vertical dashboards, not one flat list:** `/admin/businesses` is now a landing page —
one card per active vertical (read from the `verticals` table, ADR-0009, not a hardcoded
list), each showing a business count and linking to `/admin/businesses/vertical/[vertical]`,
which lists only that vertical's businesses. The flat "everything mixed together" table is
gone. A client-side substring search (`businesses-list.tsx`) was added to the per-vertical
list once it was pointed out that this needs to stay usable if a vertical's business count
grows — mirrors the owner app's Contacts List's exact pattern (filter an already-fetched
array, not a dedicated search system), appropriate at this product's actual current scale; if
a vertical genuinely reaches thousands of rows this would need to move server-side, which
would be over-engineering to build now, ahead of any real need.

**Settings (`/admin/settings`, new):**
- Admin profile: `admin_users.name` (editable) and email (read-only, since changing a
  sign-in email isn't self-service here) — the one profile field that actually exists in the
  schema; nothing else was invented for "other things related to admin" beyond what was
  explicitly requested afterward (MFA).
- Change password: re-verifies the *current* password first (`signInWithPassword`) before
  calling `updateUser({password})` — deliberate extra friction unique to this surface (not
  present on the owner app's equivalent), since an admin session reaches every tenant's data
  via the service-role client. Rate-limited (`admin-change-password-ip`), mirroring the login
  routes' own pattern.
- Two-factor authentication: shows the enrolled authenticator's enrollment date and a "Reset
  authenticator app" action (`mfa-section.tsx`). This does **not** offer a way to turn MFA off
  — `admin_users.mfa_required` stays fixed `true` for every admin, per ADR-0017's own
  reasoning; reset just unenrolls the current verified factor and lets the existing
  `getAdminSessionState()` guard naturally redirect to the existing `/admin/mfa/enroll` flow
  on the next visit, reusing that flow exactly rather than building a second one.
- Both new API routes (`/api/admin/settings`, `/api/admin/change-password`) re-verify the
  admin session server-side via `getAdminSessionState()` before writing through the
  service-role client — `admin_users`' RLS policy is select-only for the owning row by design
  (see that table's own comment: admin authorization lives in application code, not a
  Postgres policy), matching every other admin write route's existing pattern.

**Desktop scale-up:** after an initial moderate pass still read as too small on the project
owner's actual (very wide) monitor, went further and more decisively: page `h1`s at
`text-3xl sm:text-4xl lg:text-5xl`, section headings/body text bumped roughly one full
Tailwind step (`text-sm`→`text-base`, `text-base`→`text-lg`), every section/card wrapped in a
bordered, padded (`p-6 lg:p-9`) container rather than bare stacked text, header/main padding
increased with an added `xl:` step, and the header logo scaled up via a `scale-125` wrapper
(the shared `Logo` component itself — used by marketing and the owner app too — was left
untouched; only this one call site is enlarged). Mobile sizing (the un-prefixed base classes)
was left essentially where the first pass put it, since the complaint was specifically about
desktop, not mobile.

## Alternatives Considered

- **Vertical picker as a dropdown/segmented control on one page** instead of separate routes.
  Rejected — the project owner's own phrasing ("dashboard of each specific vertical...
  creating dashboard") reads as wanting genuinely separate views, and separate routes are
  bookmarkable/linkable in a way an in-page toggle isn't.
- **Server-side paginated search** for the businesses list. Rejected for now — see the search
  section above; this product isn't at a scale where it's needed yet.
- **A composite "admin billing" section** showing subscription payments to Ordrfy immediately.
  Not built here at all, since it needs new schema (see Consequences) and was only clarified
  after the payments-table version had already shipped and been reverted.

## Consequences

- All changes are additive/reorganizing within the admin panel; no shared component
  (`Button`, `Chip`, `Logo`, etc.) was modified, so the owner app and marketing site are
  unaffected.
- The "subscription payment to Ordrfy" ask remains genuinely unbuilt — there is no table
  anywhere tracking what a business has paid Ordrfy for their own subscription. Tracked as an
  open item in `docs/decisions-register.md`, not guessed at here.
- Verified: typecheck, lint, and production build all clean. Live verification of the
  MFA-gated pages specifically was done by the project owner directly in their own
  authenticated session (screenshots reviewed live during this session) rather than by
  re-deriving a TOTP code for a throwaway admin account created earlier in this session --
  that account's own MFA challenge could not be reliably re-verified programmatically at this
  point, which is a dead end specific to that one throwaway account, not a defect in the
  actual MFA implementation the project owner is using.
