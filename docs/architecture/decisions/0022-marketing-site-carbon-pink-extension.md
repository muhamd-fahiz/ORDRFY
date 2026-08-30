# ADR-0022: Marketing Site Built on Carbon Pink, With Four New Tokens

**Status:** Accepted (2026-08-30)

## Context

The project owner commissioned a marketing landing page design from Claude Design (handoff
bundle: `Ordrfy Landing.dc.html`, `Ordrfy Logo.dc.html`, a README, and `support.js` — a
prototype runtime explicitly marked "do not port"). The instruction was to build the real
`(marketing)/` route group "using the actual Carbon Pink design tokens already in the
codebase" while matching the handoff "as closely as possible."

Reading the handoff's own documented palette against `tailwind.config.ts` surfaced a real,
load-bearing mismatch: the handoff's `pink hover` is `#FF2B95` — a **brightened** shade for
hovering a pink-filled element — while the existing `pink.strong` token (added for the owner
app in ADR-0016) is `#B10E63`, a **darkened** shade used for the same kind of hover
elsewhere in the product. These aren't just different hex values; they're opposite
directions on the same interaction, so `pink.strong` couldn't be reused for the marketing
site's pink-fill hover without contradicting the handoff's own spec. The handoff also names
two colors with no existing equivalent (`ink raised` for chat-bubble surfaces, `paper warm`
for text on a pink background) and one entirely new color (`highlight` yellow, the slip's
due-date badge) that don't fit under any existing token.

Separately, the handoff's `ink`/`paper` base values (`#12100F`/`#FAF7F2`) differ very
slightly from the existing `ink.DEFAULT`/`paper.DEFAULT` (`#14171F`/`#FAF9F7`) — both pairs
read as "near-black"/"near-white," a few points apart.

## Decision

- **Reused `ink.DEFAULT`, `paper.DEFAULT`, `pink.DEFAULT` exactly as they already exist.**
  The few-point hex difference from the handoff's own values is within the tolerance of
  "recreate faithfully using the codebase's own token system" — changing them would have
  retroactively altered the owner app and admin panel's already-shipped, already
  browser-verified screens, which nothing about this task asked for or justified.
- **Added four new tokens, additive only** (`tailwind.config.ts`): `ink.raised` (`#1F1C1A`),
  `paper.warm` (`#FFF9F2`), `pink.hover` (`#FF2B95`), and a new top-level `highlight`
  (`#FFD84D`). `pink.hover` is deliberately its own token rather than a reused/renamed
  `pink.strong` — the two represent genuinely different interaction directions (brighten vs.
  darken) for the same base color, and collapsing them into one token would silently break
  whichever surface didn't get the direction it actually specs.
- **Extended `lib/design/fonts.ts`'s Unbounded weights** from `400/700` to `400/600/700/800`
  — the marketing hifi spec's headlines require 800, which the owner app/admin never needed.
- **The logo mark (`public/logo-mark.svg`) is hand-drawn vector shapes, not a text glyph.**
  The handoff's own README states the logo has "no image, icon or illustration assets...
  drawn from Unbounded letterforms" — true within its own prototype (rendered inline where
  the page's own CSS already loaded the webfont), but a standalone SVG referenced via
  `<img>` (favicons, the header's `Image` component, any future external use) has no access
  to that CSS and falls back to the browser's default font. Confirmed this by opening the
  first, text-based version of the asset directly: the fallback font rendered the full stop
  as a visibly wrong glyph. Rebuilt it as a stroked-circle ring plus a filled dot — a
  font-independent shape that reads as the same "o." mark in every context, with zero
  webfont dependency.

## Alternatives Considered

- **Change `ink.DEFAULT`/`paper.DEFAULT` to the handoff's exact values, applied product-wide.**
  Rejected — would have silently reshaded the owner app and admin panel, both already
  shipped and verified, for a few points of hex difference nobody would perceptibly notice
  against the *current* screens, at the cost of needing to re-verify every existing surface.
- **Give the marketing site its own fully separate palette, outside the `ink`/`paper`/`pink`
  namespace.** Rejected — directly contradicts the explicit instruction to use the existing
  Carbon Pink tokens, and would make the "one design system, easy to adjust" goal harder,
  not easier, by fragmenting where a color lives.
- **Keep the logo mark as font-based text and accept the fallback-font risk.** Rejected once
  actually observed: "might render oddly without the webfont" turned from a theoretical
  concern into a visible bug the moment the file was opened outside the app's own CSS
  context — worth fixing now rather than shipping a known-fragile asset.

## Consequences

- Every other visual token, component (`Button`, `Chip`), and font family this ADR didn't
  explicitly touch is unchanged — the marketing site's fidelity to the handoff comes from
  new, additive tokens layered onto the existing system, not a parallel one.
- `components/ui/Logo.tsx` is the one place the wordmark/mark render — built reusable enough
  that the owner app and admin panel headers could adopt it later (currently plain text in
  both), though doing so wasn't part of this task and those surfaces were left untouched.
- Verified live against the local dev server at 320 / 768 / 1440px, plus every interactive
  piece (vertical tabs via click and arrow keys, single-open FAQ accordion, all anchor nav)
  — confirmed via direct DOM measurement (`scrollWidth` vs `innerWidth`), not just visual
  screenshots, that no width introduces horizontal overflow, including the pricing card's
  hard `8px 8px 0` shadow at 320px, which the handoff's own README specifically flagged as
  a risk to check.
