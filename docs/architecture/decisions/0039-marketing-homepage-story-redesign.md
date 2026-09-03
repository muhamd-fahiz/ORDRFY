# ADR-0039: Marketing Homepage Story Redesign

**Status:** Accepted (2026-09-04)

## Context

The marketing homepage (built 2026-08-30 from the original Claude Design handoff) explained
the product well but never made a visitor recognize their own problem before showing the
fix — the page went Hero → How It Works → Verticals → What It Handles, a product tour, not a
persuasion arc. Two sections also read as visibly unfinished on a live page: `AboutUs.tsx`'s
"Our story, coming soon," and `Pricing.tsx`'s dashed-border "PLACEHOLDER · ₹ TBD" stamp with a
literal `₹—` in every plan card. The target audience is explicitly non-technical business
owners; the redesign's brief was to fix the story and the two unfinished-looking sections
without touching backend/AI/database code, without a new visual system, and without any
technical or internal vocabulary reaching the page.

## Decision

**New homepage order**, replacing Hero → HowItWorks → VerticalsShowcase → WhatItHandles →
Pricing → Faq → AboutUs → ClosingCta:

Hero → **ProblemRecognition** (Chaos) → **TheShift** (Organization) → HowItWorks
(Simplicity) → **AutomationControl** → VerticalsShowcase → WhatItHandles (reframed to
outcomes) → **Trust** (absorbing AboutUs) → Pricing (re-presented) → Faq → ClosingCta.

**`ProblemRecognition`** names the visitor's actual daily reality — repeated questions, a
buried order, an unanswered customer — deliberately without mentioning Ordrfy at all.
**`TheShift`** is the payoff: it pulls the *exact same* message back out of
`CHAOS_MESSAGES` (`lib/marketing/content.ts`) and resolves it into an `OrderSlip`, so the
same conversation visibly becomes the answer rather than two unrelated illustrations
standing in for each other. Both share one visual language (the existing chat-bubble shape
from `Hero.tsx`) via a single new `ScatteredMessages` component — no new bubble style.

**`AutomationControl`** is the CONTROL beat, grounded only in what ships today: two
labeled example cards, "Handled automatically" and "Flagged for you," using the product's
own existing color meanings (`confirmed` green for done, `attention` amber for needs-you —
both already used this way in the owner app) rather than inventing a new visual vocabulary.
No mention of classification, confidence, or any internal term; no reference to per-contact
takeover (ADR-0028), which isn't built.

**`WhatItHandles`** reframed from "the four things that go wrong" to "what you get back" —
the CHAOS beat now lives earlier, so repeating the same problems here would be redundant;
this section is the outcome recap instead, same four real categories, positive framing.

**`Trust`** replaces `AboutUs.tsx` entirely (file deleted). Two honest paragraphs: a
mission statement (built in India, for WhatsApp/Instagram-native businesses — the one part
of the old About Us that wasn't a placeholder) and the data-safety claim already made in
`Faq.tsx`, surfaced instead of left buried. No fake testimonials, statistics, or logos.

**Pricing** keeps the real, undecided-pricing fact but removes every visibly-unfinished
signal: the dashed "PLACEHOLDER · ₹ TBD" badge is gone, and each plan's ghost `₹—` is
replaced with "Early access" plus a plain-language note ("locked in at today's rate ... once
pricing launches"). No number is invented anywhere.

**Nav anchors**: `MarketingHeader`/`MarketingFooter`'s `#about` link is renamed to `#trust`
in the same change as the section itself, so nothing ever points at a missing anchor.

## Alternatives Considered

- **A literal side-by-side split for `TheShift`'s before/after** (chaos pile directly next
  to the slip). Rejected in favor of the existing responsive grid pattern already used by
  `Hero`/`VerticalsShowcase` (text column + visual column, collapsing to stacked on mobile) —
  introducing a bespoke split layout would be exactly the "new visual system" the brief said
  not to build.
- **Keeping a standalone, separately-headed About section** alongside Trust. Rejected per
  explicit instruction — folded into one section so the page doesn't grow an 11.5th section
  for content that's two short paragraphs.
- **A technical-sounding "AI/Automation" section title.** Kept "Automation + Control" as
  approved — "automation" itself is ordinary English a shop owner already understands
  ("automatic reply"); the internal vocabulary that had to stay out was terms like
  classification, confidence, provider, and routing, not the word "automation" itself.

## Consequences

- Files added: `ScatteredMessages.tsx`, `ProblemRecognition.tsx`, `TheShift.tsx`,
  `AutomationControl.tsx`, `Trust.tsx`.
- Files removed: `AboutUs.tsx`.
- Files edited: `app/(marketing)/page.tsx` (composition/order only), `WhatItHandles.tsx`
  (copy reframed), `Pricing.tsx` (placeholder presentation removed), `MarketingHeader.tsx` /
  `MarketingFooter.tsx` (one nav link renamed), `lib/marketing/content.ts` (added
  `CHAOS_MESSAGES`).
- No backend, database, AI/automation-engine, webhook, or auth code touched — confirmed via
  `git diff` against every non-marketing path. No new dependency added. No Tailwind token
  added; `AutomationControl` reuses the existing `confirmed`/`attention` tokens.
- Verified: typecheck, lint, and production build all clean; full live render checked at
  desktop and mobile widths, including a `scrollWidth`/`clientWidth` check confirming no
  horizontal overflow introduced by the new staggered-message visual.
