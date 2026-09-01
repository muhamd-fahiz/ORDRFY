# ADR-0027: Simplicity Pass — Plain Business Language, Safe Dropdowns, Hidden Empty States

**Status:** Accepted (2026-09-02)

## Context

The project owner requested a full non-technical-user usability review ahead of Security
Hardening, driven by an explicit product principle: Ordrfy's target user (a boutique/home
baker/tutor/gift-seller/local service owner, comfortable with WhatsApp and Instagram but not
with CRM/SaaS software) should never need to understand pipeline, automation, or
configuration terminology to use the product. The review (delivered as a report, not
implemented) found several real terminology leaks and a couple of missing-feedback gaps
across the owner-app screens. The project owner approved a specific subset of findings for
implementation now, explicitly deferring feature work (manual takeover, calendar, stage-chip
outcome coloring pending a schema question) to separate decisions.

## Decision

**Terminology, renamed across all owner-facing text (not just the flagged screens — applied
consistently everywhere the same word appeared, per the review's own "avoid CRM
terminology" principle):**
- "Contacts" → "Customers" — nav label, page heading, back-link, and both list/detail empty
  states (`app/app/(protected)/layout.tsx`, `contacts/page.tsx`, `contacts/[id]/page.tsx`,
  `contacts/contacts-list.tsx`). The `/app/contacts` URL path and internal
  `contacts`/`pipeline_stage`/`Stage`-prefixed component and prop names are unchanged — this
  is a user-facing text change only, not a route or schema rename.
- "Pipeline Stage" (Contact Detail section heading) → "Status".
- "No stage set" (chip fallback, three call sites: Today, Attention, Customers list) → "No
  status yet", and "No contacts in this stage." → "No customers with this status." — the
  same leak the review flagged for the one heading was present in these chip fallbacks too;
  fixed for consistency rather than leaving "stage" partially visible elsewhere.

**Hidden empty state instead of a technical message:** Contact Detail's "Order Details"
section (`vertical_field_definitions` / `order_field_values`) previously always rendered,
showing *"No vertical-specific order fields for this business type"* when a business has none
configured. The whole `<section>` is now omitted entirely when `verticalFields.length === 0`,
per the review's own "hide, don't explain the internals" recommendation — this also directly
serves progressive disclosure (nothing shown unless there's something to say).

**Settings: free-text fields replaced with safe dropdowns, values preserved underneath:**
- Timezone: `<select>` with one real option, "India (IST)" → `Asia/Kolkata` — deliberately
  not padded with extra choices. Every business created to date (`app/admin/(protected)/
  businesses/new/actions.ts`'s own default) is set to `Asia/Kolkata`; there is no second real
  timezone in this product's actual target market. If a business's stored value somehow
  doesn't match, it's added as an extra `Current setting (<value>)` option rather than
  silently overwritten — the dropdown can never change a value the owner didn't select.
- Preferred language: `<select>` with "English" (`en`) / "Hindi" (`hi`) — the only two
  languages with real matching `internal_reply_rules`/`message_templates` content today (per
  ADR-0007). The same current-value preservation applies. The column itself is unchanged —
  still free text at the schema level per ADR-0007's own reasoning (matching is a function of
  which content rows exist, not a hardcoded enum) — this is a UI-layer restriction to the set
  of choices that currently do something, not a schema or architecture change.
- Preferred-language help text rewritten from *"The language customer replies are matched
  against... falls back to English if no rules exist for this language"* to *"Which language
  Ordrfy should use when replying automatically."*
- A one-line note added above Phone/Email clarifying they're the business's own contact
  details, not the WhatsApp/Instagram number — closing a real ambiguity the review flagged
  (nothing on the page previously distinguished the two).
- `POST /api/app/settings` gained one small server-side check: a submitted timezone must be
  either the one known-safe value or the business's own already-stored value, otherwise the
  request is rejected with a plain error. Preferred language is deliberately **not**
  similarly restricted server-side — restricting it would work against ADR-0007's explicit
  design (arbitrary codes are architecturally legal; they just have no matching content and
  safely fall back to `en`), so only the UI's offered choices changed, not the column's
  validation.

**Needs Attention:**
- "Review" → "Mark as handled" (`ContactActions`, shared by Today and Attention) — the
  project owner's own stated preference, to make clear the attention item is being resolved,
  not just read.
- A brief "Marked as handled." confirmation now shows for ~900ms before the list refreshes,
  mirroring the exact pattern `PaymentActions` already uses for "Marked as paid." — closes
  the one action in the product that previously gave no feedback beyond the row silently
  disappearing.
- Subtitle rewritten from *"Oldest waiting first, regardless of who messaged most
  recently"* to *"Oldest first — customers who've been waiting longest."*

**Today, first-time/empty state:** *"No customer messages yet. Once WhatsApp or Instagram is
connected, new chats will show up here automatically"* → *"No customer messages yet. New
chats from WhatsApp or Instagram will appear here automatically"* — removes the implication
that the owner personally needs to go connect something (channel connection is admin-managed
in V1, not a owner self-service action). Kept to one sentence, no onboarding flow or tutorial
added, per the project owner's explicit "no tutorial" instruction.

## Alternatives Considered

- **Stage-chip outcome coloring (in-progress/completed/cancelled), item 12 of the review.**
  Investigated for a "clean, no schema change" implementation and found none exists:
  `stage_key` naming isn't consistent across verticals (Tutor's terminal stage is `paid`, not
  `completed`), and `sort_order` is already documented (CLAUDE.md) as unreliable for this —
  Baker/Gift's `cancelled` stage sorts *after* `completed`. A clean implementation would need
  a small additive classification column (e.g. `pipeline_stages.stage_type`), which is a
  schema change, not a display-only fix. Per the project owner's own conditional instruction
  ("only if it can be implemented cleanly... I want visual clarity, not a complicated color
  system"), this was **not implemented** — reported back instead, tracked as an open item in
  `docs/decisions-register.md` pending the project owner's call on whether to approve the
  small schema addition.
- **Restricting `preferred_language` server-side to `en`/`hi`.** Rejected — would contradict
  ADR-0007's deliberate "not a hardcoded enum" design. The UI-only restriction achieves the
  same simplicity goal without touching validation semantics.
- **A longer timezone dropdown "for future-proofing."** Rejected — padding a dropdown with
  options nobody in the actual current business base uses is itself a violation of "no
  unnecessary choices," one of the review's own stated non-technical-UX questions.

## Consequences

- Every terminology fix here is copy-only; no route, schema, or API contract changed except
  the one small additive timezone check in the settings route (defense against a bad value,
  not a new validation regime).
- The Order Details section's "always empty in real usage" behavior surfaced a bigger, still
  fully open question during this pass (see the Contact Detail investigation recorded
  separately): `order_field_values` has no write path anywhere in the product yet — not from
  the owner app, not from the message-processing engine — so the section will, in fact, never
  show anything for a real (non-fixture) contact today. Hiding it when empty is correct
  regardless of how that question resolves.
- Verified live against a real signed-in owner session (fixture account
  `meera.owner@example.com`, password reset to a temporary known value for this session's
  testing only and randomized again immediately after): nav/heading renames, the hidden
  Order Details section, both Settings dropdowns round-tripping through a real save, and a
  real "Mark as handled" click (via a temporarily inserted `owner_attention_queue` row,
  deleted after) resolving the item and clearing from the list.
