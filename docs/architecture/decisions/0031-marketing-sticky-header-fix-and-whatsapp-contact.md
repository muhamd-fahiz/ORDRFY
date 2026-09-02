# ADR-0031: Sticky Header Fix, WhatsApp Contact CTAs, and an About Us Placeholder

**Status:** Accepted (2026-09-02)

## Context

Three small marketing-site items surfaced during the project owner's own hands-on review:

1. **Real bug:** the header (`MarketingHeader`, already coded with `position: sticky`) was
   not actually staying fixed while scrolling — it disappeared past a certain scroll depth.
2. The project owner wants every "contact us"-style CTA to open WhatsApp instead of email —
   more natural for this audience, who already reach businesses that way — with email kept
   only as a small secondary fallback.
3. A placeholder "About Us" section, content to be designed properly later.

## Decision

**Sticky header bug — root cause and fix:** `app/(marketing)/layout.tsx` wraps the page in a
div with `overflow-x-hidden` (added deliberately, per ADR-0022, to guarantee no horizontal
scroll at narrow widths). Per the CSS Overflow spec, setting `overflow-x` to any value other
than `visible` forces the browser to compute `overflow-y` as `auto` too, turning that div
into a scroll container — and `position: sticky` descendants resolve their sticky offset
against the nearest such container, not the viewport. `MarketingHeader` is a direct child of
that div, so it stuck (uselessly) relative to a container that never itself scrolls, instead
of the page. Fixed by changing `overflow-x-hidden` to `overflow-x-clip`: `overflow: clip`
suppresses the same visual overflow without establishing a scroll container, so it doesn't
have this side effect. Verified live: scrolled through the full page, header stays pinned
throughout; re-checked `scrollWidth` vs `innerWidth` to confirm the original horizontal-
overflow guarantee still holds.

**WhatsApp contact CTAs:** added `MARKETING_CONFIG.whatsappNumber` — explicitly a dummy
placeholder (`910000000000`) until a real WhatsApp Business number exists; every CTA reads
this one value, so replacing it later is a one-line change. `lib/marketing/whatsapp.ts`
exports `getWhatsAppLink(prefilledText)`, building a `wa.me` deep link with a pre-filled
message per CTA. Plain `<a>` tags are used (not a client-side-constructed link like
`MailtoButton`) since a `wa.me` URL has no `mailto:`/`@`-shaped content for Cloudflare's
tunnel-level email obfuscation to rewrite — that specific hydration risk (ADR-0026) doesn't
apply here.

Converted: `ClosingCta`'s "Request Early Access" and "Email us" (renamed "Message us on
WhatsApp") buttons, and `Pricing`'s Studio-plan "Talk to us" button (via a new optional
`ctaHref` prop on `PlanCard`, defaulting to the existing `#start` anchor-scroll the other two
plans still use). A small, deliberately secondary "Or contact us by email" text link
(`MailtoButton`, styled as plain text, not a button) was added below the two WhatsApp buttons
in `ClosingCta` — WhatsApp is the primary path for this audience; email is an explicit
fallback, not a second prominent option.

**About Us:** `components/marketing/AboutUs.tsx`, a structural placeholder only — an eyebrow,
heading, and one honest placeholder sentence, mirroring `Pricing.tsx`'s own explicit
"PLACEHOLDER" treatment rather than inventing a company narrative that isn't mine to write.
Wired into the page between FAQ and the closing CTA, with matching nav links added to both
`MarketingHeader` and `MarketingFooter`. Real content/design for this section is an explicit,
separate later decision, not decided here.

## Consequences

- The sticky-header fix is a one-word CSS value change with no functional side effects
  beyond restoring the intended behavior — verified live, no regression to the horizontal-
  overflow guarantee it sits next to.
- Every "contact us" CTA now points at a dummy WhatsApp number. This must be replaced before
  any real customer or friend tester could act on these buttons — tracked as a pending
  action, not a new open decision (the real number is expected imminently, per the project
  owner).
- `AboutUs.tsx` is intentionally unfinished content — flagged directly in its own file
  comment so a future session doesn't mistake the placeholder sentence for approved copy.
