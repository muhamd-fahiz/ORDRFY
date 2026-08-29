# ADR-0016: "Carbon Pink" Design Tokens, Namespaced Separately From the Admin Panel

**Status:** Superseded by [ADR-0021](0021-carbon-pink-extended-to-admin-panel.md) (2026-08-30) for the
namespacing/admin-untouched decision below. The token set, component library, and font
wiring this ADR introduced are still exactly as described — only the "admin panel stays
untouched" boundary changed.

## Context

The owner-facing app needed a real visual identity — distinctive, mobile-first, fast for daily use — while the admin panel needed to stay untouched: CLAUDE.md's "what NOT to build in V1" list explicitly excludes a "polished admin UI (functional only)." Both surfaces share one Tailwind config, so a new design system had to coexist with the admin panel's existing `brand`/`status` color tokens without either restyling the admin panel or forcing the owner app to inherit its look.

## Decision

Three concepts were proposed side by side (Carbon Pink — a tailor's duplicate order slip; Marigold Thread — a rounded, festive chat-bubble aesthetic; Steel & Brass — a trustworthy ledger/passbook aesthetic), each built on the same component structure so they were a fair comparison, not just palette swaps. Carbon Pink was chosen.

Implementation:
- New Tailwind color/font tokens (`ink`, `paper`, `pink`, `confirmed`, `attention`, `vertical.*`; `font-display`/`font-app`/`font-data`) added as siblings to the admin panel's existing `brand`/`status` tokens in `tailwind.config.ts` — additive only, the admin panel's tokens are untouched.
- Fonts (Unbounded, Hanken Grotesk, Space Mono) loaded via `next/font/google` and scoped to the owner-app route tree via a layout-level wrapper (`app/app/(protected)/layout.tsx`, `app/design-preview/layout.tsx`), never applied to the root layout — so `/admin/*` pages keep rendering in the browser's default font, unaffected.
- A small component library (`components/ui/`: `Button`, `Chip`, `ContactCard`, `VerticalBadge`, `AttentionBanner`) consumes the new tokens exclusively.
- Vertical accent colors are a data lookup (`lib/design/verticals.ts`), never a conditional in a component — consistent with Non-Negotiable Architecture Rule 1.

## Alternatives Considered

- **Restyle the admin panel to match, for visual consistency across the whole product.** Rejected outright — directly contradicts the explicit V1 scope decision that the admin UI stays functional-only.
- **Reuse the admin panel's `brand` token for the owner app's accent color.** Rejected — the two surfaces need independently adjustable palettes (the admin panel isn't meant to be iterated on visually; the owner app explicitly is, per the user's own framing that "approved for now" doesn't mean "locked forever").

## Consequences

Verified against the live dev server: `/design-preview` renders correctly with the new tokens; `/admin/login` renders unchanged (still its original teal `brand` color and default browser font) — checked in the same browser session immediately after wiring the new tokens in, not assumed.
