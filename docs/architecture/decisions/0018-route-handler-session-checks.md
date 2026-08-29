# ADR-0018: Route Handlers Check Session State Directly, Never Call the Redirect-Based Guard

**Status:** Accepted (2026-08-29)

## Context

`requireReadyAdminSession()` and `requireReadyOwnerSession()` (`lib/auth/admin-guard.ts`, `lib/auth/owner-guard.ts`) call `next/navigation`'s `redirect()` on anything other than a fully-ready session — correct and idiomatic for a Server Component or layout, which is what they were originally written for.

The admin panel's "create owner account" route handler (`app/api/admin/businesses/[id]/create-owner/route.ts`) called this same guard directly. Confirmed by curling the endpoint with no session cookie: it returned a raw HTTP 307 redirect to `/admin/login`, not a 401. A `fetch()`-based client call follows redirects transparently by default, so a signed-out caller would receive the login page's HTML as the "response" and throw trying to `JSON.parse()` it, rather than seeing a clean error.

## Decision

Route handlers under `app/api/` check the non-redirecting session state directly (`getAdminSessionState()` / `getOwnerSessionState()`) and return an explicit `NextResponse.json({ error: ... }, { status: 401 })` when the session isn't `ready`. The redirect-based `requireReady*Session()` functions remain correct and unchanged for their original use (Server Components, layouts) — the fix is about which function a route handler calls, not about the guards themselves being wrong.

## Alternatives Considered

- **Leave route handlers calling the redirect-based guard, since it "worked" in the one path actually exercised (an authenticated caller).** Rejected once the unauthenticated path was actually tested — the failure only shows up for a signed-out caller, which is exactly the case a guard exists to handle correctly.

## Consequences

Fixed in the pre-existing admin create-owner route and applied from the start in the new owner-app mutation routes (`app/api/app/attention/resolve/route.ts`, `app/api/app/reminders/send-now/route.ts`). Any future `app/api/` route handler that needs an admin or owner session should follow this same pattern — call the `get*SessionState()` variant, not the redirect-based `requireReady*Session()`.
