# ADR-0041: Deterministic Onboarding Knowledge Engine

**Status:** Accepted (2026-09-05)

## Context

The guided onboarding wizard (ADR-0040) needs to turn one free-text answer to "What do you
sell or do?" into a vertical assignment and a set of relevant follow-up questions, for a
non-technical owner who may write in Hinglish, with typos, in a single casual sentence. The
product's own knowledge-first principle — decided before any implementation began — is that
this must work completely without AI: a deterministic engine first, with AI at most a future,
optional, provider-agnostic fallback that is never built or called in this phase. This ADR
documents the engine as implemented (`lib/onboarding/`), not the original proposal.

## Decision

### `VerticalKey` is the single source of truth

Every vertical definition, the detection result, and the wizard's own state are typed
against the existing `VerticalKey` from `lib/design/verticals.ts`
(`"fashion" | "tutor" | "service" | "baker" | "gift"`) — no parallel type was created. This
was a deliberate correction against an earlier draft of this work that used mismatched names
(`clothing`/`bakery`/`services`); using anything other than the real schema keys would either
violate the `businesses.vertical` foreign key at provisioning time or require a translation
layer nobody wants to maintain.

### Vertical definitions

`lib/onboarding/verticals/{fashion,baker,tutor,service,gift}.ts` each export a static
`VerticalKnowledgeDefinition`: canonical `keywords`, an `aliases` map (misspellings/plurals/
regional variants too different from a keyword for edit-distance alone to catch reliably),
`suggestedAttributes` and `suggestedOperatingPreferences` chip lists for the wizard's
adaptive screen, and `followUpPrompts` (not consumed by this phase, reserved for a future
adaptive-questioning refinement). `lib/onboarding/verticals/index.ts` aggregates all five into
one array `detect-vertical.ts` iterates generically. Adding a 6th vertical later means one new
file plus one array entry — no change to the detection code itself, the same "insert a row,
not a migration" extensibility ADR-0009 already established for the `verticals` table.
`"boutique"` deliberately appears as a keyword on both `fashion.ts` and `service.ts` — it is
the canonical worked example of genuine ambiguity (a boutique could be clothing or a
beauty/service business), and the engine must surface that as ambiguous, not silently guess.

### Normalization and typo tolerance

`normalize-text.ts` lowercases, strips accents (`\p{M}`), replaces punctuation with spaces,
and collapses whitespace — applied identically to the input and to every keyword/alias being
matched against it. `text-similarity.ts` provides a hand-rolled Levenshtein distance (no
dependency added — matching a short answer against a few dozen static keywords per vertical
does not need a fuzzy-search library, and `pg_trgm` is not enabled in this project) with a
length-scaled tolerance: exact-only below 5 characters, then 1 or 2 characters of slack for
longer words. Matching also requires the same first character — found necessary live, not
assumed: without it, ordinary English words sharing a long suffix with a keyword (`"nothing"`
vs `"clothing"`) were being fuzzy-matched as typos, since real typos essentially never change
a word's first letter.

### Scoring: token-centric, not keyword-centric

`detect-vertical.ts` scores each vertical by iterating the input's *unique tokens* once each,
taking the best available match per token (exact keyword > fuzzy keyword > exact alias >
fuzzy alias) — this was a correction made during testing. An earlier, keyword-centric version
let one input token score against every near-duplicate keyword that happened to fuzzy-match it
(e.g. `"kurti"` scoring against `"kurti"`, `"kurtis"`, *and* `"kurta"` independently),
inflating a vertical's score unfairly against a genuinely tied competitor and breaking the
`"boutique"`-style ambiguity guarantee in a realistic sentence. Multi-word keywords/aliases
(e.g. `"custom cake"`) are matched as substrings of the whole normalized input, kept separate
from the token-centric pass since phrase near-duplicates are rare enough not to need the same
guard.

### `confident` / `ambiguous` / `unmatched`, never a silent guess

`detectVertical()` returns a status, the single best vertical when `confident`, and the full
ranked `candidates` list *always* — even when confident, so a caller can inspect the whole
picture rather than trust a collapsed winner. A vertical wins confidently only if no other
vertical scores within `AMBIGUITY_MARGIN` (1 point) of it; a tie or near-tie is `ambiguous`.
Zero matches is `unmatched`. Neither ambiguous nor unmatched ever forces a vertical — the
wizard's disambiguation screen shows the close candidates (or, when unmatched, all 5 real
verticals — there is nothing to narrow by), using the same warm framing either way rather than
a "we couldn't understand you" tone. **No 6th "generic" vertical exists or was added**: a real
business assigned to one would have zero `pipeline_stages`/`internal_reply_rules`/
`message_templates` rows, silently breaking every downstream engine feature. A forced choice
among the 5 real verticals, made by the owner with one tap, is the only fallback.

### Vertical-specific answers reset when the vertical changes

Found live, during Phase 5 verification, not assumed: if an owner edits their description
after already answering the adaptive attribute/preference questions (e.g. re-describing a
Fashion business as a Bakery), the old vertical's selections are meaningless under the new
one and, left unfixed, would render as raw untranslated key strings on the review screen and
be written permanently into `business_knowledge_profiles`. `lib/onboarding/vertical-change.ts`
exports `applyVerticalChange()`, a pure function returning the complete next state — cleared
attributes, cleared preferences, `moreSubStep` reset to 0, the free-text note preserved
exactly (it is vertical-agnostic) — called from both places the wizard resolves a vertical.
Verified live end-to-end: edited a Fashion draft (attributes `sizes`+`colours`, preference
`cod`, a note) into a Bakery description, and confirmed via direct database inspection that
the stale selections were gone and the note survived unchanged.

### No AI in this phase; a dormant, provider-agnostic boundary for later

`lib/onboarding/ai-provider.ts` defines `BusinessUnderstandingProvider`, a single interface —
`classify(rawInput, deterministicResult)` — with no implementation, no factory, no SDK
dependency, and nothing anywhere in the codebase that calls it. The deterministic engine is
complete and correct entirely on its own; this type exists only so a future, explicitly
approved phase has an agreed shape to implement against instead of guessing one under time
pressure. Onboarding must never freeze waiting on AI: since nothing calls this interface yet,
that guarantee holds trivially today, and the interface's own contract (a future
implementation must be safe under a timeout and must never be the only path to a result — the
deterministic `ambiguous`/`unmatched` handling is always the fallback) is written to keep it
true once a real implementation exists.

## Alternatives Considered

- **Vertical file names matching the original proposal's own vocabulary**
  (`clothing.ts`/`bakery.ts`/`services.ts`/`generic.ts`). Rejected — corrected to the real
  `verticals.key` values before implementation, specifically to avoid the FK-violation risk.
- **Keyword-centric scoring** (score every keyword-list entry independently). Rejected after
  it was found live to over-count near-duplicate keywords against a single input token; fixed
  to token-centric scoring.
- **Fuzzy-matching without a first-character requirement.** Rejected after `"nothing"` was
  found live to fuzzy-match `"clothing"` purely from a shared suffix.
- **A real "generic" vertical for the unmatched case.** Rejected — see "confident /
  ambiguous / unmatched" above; a silent, empty-config vertical is worse than one extra tap.
- **A concrete AI implementation "just to see it work."** Not built, deliberately, even
  though it was raised during architecture review — the deterministic engine's own
  completeness is the point, and adding a real provider call would be exactly the
  "architecture added because AI may be useful later" pattern the project's own principles
  argue against.

## Consequences

- New files: `lib/onboarding/normalize-text.ts`, `text-similarity.ts`, `detect-vertical.ts`,
  `acknowledgements.ts`, `vertical-change.ts`, `ai-provider.ts`,
  `verticals/{types,fashion,baker,tutor,service,gift,index}.ts`.
- Test coverage: `tests/unit/onboarding/detect-vertical.test.ts` (17 tests — clear matches for
  all 5 verticals, the `"boutique"` ambiguity case, unmatched/generic fallback, messy
  casing/punctuation/typos, mixed/overlapping descriptions, exact `VerticalKey` compatibility)
  and `tests/unit/onboarding/vertical-change.test.ts` (the Fashion→Bakery transformation,
  including the `"not_sure"` case and the two no-op cases). All 89 unit tests in the project
  pass with zero regressions.
- No AI dependency, no new npm package, no Postgres extension added. Detection runs
  identically client-side (instant UI feedback) and server-side (the authoritative value
  persisted by `PATCH /api/app/onboarding/draft`) — the same pure function in both places, so
  the two can never actually disagree; the server call exists as a trust boundary against a
  tampered client payload, not because the algorithm might differ.
