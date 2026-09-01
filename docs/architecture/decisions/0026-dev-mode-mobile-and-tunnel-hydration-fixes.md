# ADR-0026: Dev-Mode Mobile Testing and Cloudflare Tunnel Hydration Fixes

**Status:** Accepted (2026-09-01)

## Context

Friend-testing prep surfaced a chain of real bugs found only by testing on actual physical
devices (a phone, a PC through a Cloudflare Tunnel) — not this session's own browser
automation. The reported symptom was consistent across all of them: "FAQ + doesn't work,
can't select any vertical tab, only Fashion shows." Each fix revealed the next, distinct bug
underneath it.

## Decision

**Bug 1 — LAN device blocked from dev-mode JS/HMR entirely.** Next.js dev mode blocks any
cross-origin request for dev resources (client JS chunks, the HMR websocket) from an origin
other than the server's own, unless explicitly allow-listed via `allowedDevOrigins`. The
server-rendered HTML still arrives and looks fine, but zero client JS loads, so every
`"use client"` component — the FAQ accordion, the vertical tabs, both reported — has no
working click handler at all. Confirmed via the dev server's own logs: repeated "Blocked
cross-origin request to Next.js dev resource" entries for the phone's LAN IP
(`192.168.1.107`). Fixed by adding that IP to `next.config.mjs`'s `allowedDevOrigins`.

**Bug 2 — same failure mode, a different origin (Cloudflare Tunnel).** A Cloudflare quick
tunnel (`trycloudflare.com`) hands out a new random hostname every run, so it can't be
pre-listed as a static entry. `allowedDevOrigins` supports wildcard patterns, so
`"*.trycloudflare.com"` was added instead of a literal hostname — confirmed to allow-list
every quick-tunnel run without needing an update each time.

**Bug 3 — Cloudflare's edge rewrites literal `mailto:` links, breaking hydration for the
whole page.** After Bug 2's fix, HMR connected and resources returned 200, but the tabs
still didn't respond — `Object.keys()` on a tab button showed zero React fiber/props keys,
meaning React never hydrated that node at all, despite no console errors. Root-caused by
fetching the raw HTTP response through the tunnel directly (bypassing any rendered DOM
state) and finding Cloudflare's own `__cf_email__` / `email-decode.min.js` markers in it:
Cloudflare's free tunnel runs "Email Address Obfuscation" at the edge by default, which
rewrites any `mailto:` pattern found in the server-rendered HTML body before it reaches the
browser. That rewrite changes the DOM enough to break hydration for the *entire* page, not
just the rewritten element — explaining why unrelated components (the vertical tabs) were
also affected.

Fixed with `components/marketing/MailtoButton.tsx`: a client component that never renders a
literal `mailto:` string into server HTML at all. The address is assembled
(`["hello","ordrfy.in"].join("@")`) and navigated to only inside an `onClick` handler, which
Cloudflare's edge-side HTML rewriter never sees. `ClosingCta.tsx`'s two mailto anchors were
replaced with it.

**Verification, for all three:** dispatched real `.click()` calls against the DOM (not just
visual screenshots) to confirm `aria-selected`/`aria-expanded` and rendered content actually
update; fetched the raw HTML through the live tunnel and confirmed zero `__cf_email__`
markers after the fix; confirmed real React fiber keys exist on the tab button DOM node
post-fix (proof hydration actually completed, not just "no console error").

**Also added:** an `"ordrfy-prod"` entry in `.claude/launch.json` (`npm run start`) for
testing a real production build behind a tunnel — production builds have no
`allowedDevOrigins` restriction at all, so this remains the fallback if a future edge-side
rewrite ever breaks dev mode again in a way that can't be worked around.

## Alternatives Considered

- **Disable Cloudflare's Email Address Obfuscation feature instead of avoiding the literal
  string.** Not available on a free quick tunnel (no dashboard/zone to configure it on,
  unlike a named tunnel on a real zone) — ruled out as inapplicable here, not chosen against
  on preference.
- **Stay on a production build (`npm run start`) as the permanent fix for tunnel testing**,
  rather than restoring dev mode. Rejected per explicit instruction ("can you do one thing in
  dev can you fix the isse as for now") — the project owner wanted dev mode itself fixed, not
  routed around.

## Consequences

- `allowedDevOrigins` now carries two entries with different lifetimes: a literal LAN IP
  (update if the testing device's address changes) and a wildcard that needs no maintenance.
- Any other place in the codebase that renders a literal `mailto:` link server-side carries
  the same latent risk under a Cloudflare quick tunnel specifically (not under the LAN IP, and
  not in production behind a normal domain) — `MailtoButton` is the pattern to reach for if
  one is added.
- This is the second edge-case class of hydration bug found this session purely through
  real-device/real-tunnel testing rather than automation (the first being the `<html>`/`<body>`
  browser-injected-attribute case) — reinforces that dev-mode network-path testing is a
  distinct verification surface from same-machine `localhost` automation.
