# Ordrfy Addendum — Vertical Expansion: 3 → 5 Business Types

**Status: SCHEMA BUILT AND CONTENT SEEDED (2026-08-28).** The "still needed" gap below was
resolved same-day — see `docs/decisions/2026-08-28-bakers-gift-businesses.md` for what was
actually seeded and the judgment calls made along the way. Read alongside CLAUDE.md and the
prior addenda.

## Verticals, now 5 total

1. Fashion
2. Tutor
3. Appointment-Based Service
4. Baker / Custom Cake Business — **NEW**
5. Personalized / Surprise Gift Business — **NEW**

This is the project owner's direct scope decision, addressed the same way the original
3-verticals-together and 2-channels-together decisions were: as a deliberate business call,
not something to push back on architecturally. The shared-engine philosophy accommodates it
by design — a 4th and 5th vertical are exactly the kind of thing `pipeline_stages`/
`internal_reply_rules`/`message_templates` being config data rather than code was for.

## The one real gap this expansion exposed: no generic place for vertical-specific order fields

**Problem:** Fashion and Tutor's original scope never needed a flexible "order details"
concept. Baker and Gift Business introduce many fields that don't fit the existing schema
(cake flavour, eggless/egg, custom design notes, occasion, recipient relationship,
personalization text, surprise-delivery flag, budget range, delivery address, ...) — and
these differ per vertical. Bolting them onto `contacts`/`payments` as new nullable columns
per vertical would scatter per-vertical special-casing into the shared tables — the same
anti-pattern the "no vertical conditionals in shared-engine code" rule prevents, just at the
schema level.

**Built** (`supabase/migrations/20260828120024_vertical_field_definitions.sql`):

```
vertical_field_definitions
  id, vertical (FK verticals.key), field_key, field_label,
  field_type ('text'|'number'|'boolean'|'date'|'select'),
  select_options (text[], nullable — for field_type='select'),
  is_required, sort_order, active
  UNIQUE (vertical, field_key)

order_field_values
  id, contact_id, business_id, field_definition_id (FK vertical_field_definitions),
  value_text, value_number, value_boolean, value_date,
  created_at, updated_at
  UNIQUE (contact_id, field_definition_id)
```

A structured table over a single `jsonb` column on `contacts` was a deliberate choice: jsonb
can't enforce required fields, validate `select` options, or support an indexed query like
"all orders with `surprise_required = true` due this week" — which the Gift dashboard
explicitly needs per the source addendum.

**Migration placement, adjusted from the original suggestion**: the source addendum
suggested slotting this in "after `0007_pipeline_stages` and before `0011_internal_reply_
rules`." By the time this addendum arrived, several other addenda had already added
migrations 0019–0023 (consent routing, template category guard, system health, owner
attention queue) — the numbering had moved on. `vertical_field_definitions`/
`order_field_values` only depend on `contacts` (0008) and `verticals` (0000, see below)
existing, both satisfied well before this file's position at 0024. Functionally equivalent,
just not adjacent to 0007 anymore.

## A second gap this expansion exposed, not mentioned in the source addendum: hardcoded vertical CHECK constraints

**Problem found during implementation**: `vertical` was independently hardcoded as
`text check (vertical in ('fashion','tutor','service'))` on **five** tables (`businesses`,
`pipeline_stages`, `internal_reply_rules`, `message_templates`, and now
`vertical_field_definitions`). Expanding to 5 verticals meant either editing all five CHECK
lists by hand now, or fixing the underlying pattern — which directly contradicts the source
addendum's own stated goal for `vertical_field_definitions` ("adding a 6th vertical later
means inserting rows, not writing a migration") if the *other* four tables still required a
migration to add a vertical.

**Built** (`supabase/migrations/20260828120000_verticals.sql`): a `verticals` reference
table (`key text primary key`, `label`, `active`), exactly analogous to the existing
`channels` table. Every `vertical text check (...)` column across all five tables now
`references verticals(key)` instead. Deliberately keeps `vertical` as a plain `text` column
everywhere it already was — including the pipeline-stage guard trigger's direct text
comparison and every literal string in `seed.sql` — only the validation mechanism changed,
from a hardcoded list to a real table, minimizing ripple into already-built logic.

Seeded: `fashion`/`tutor`/`service` as `active = true`; `baker`/`gift` inserted as
`active = false` — they exist so other tables can reference them, but aren't ready for a
business to be assigned to them until their real pipeline/template/reminder content is
seeded (see below).

## Resolved: Baker and Gift content (2026-08-28)

The "Bakers & Gift Businesses" source document referenced above was received the same day
and fully seeded — see `docs/decisions/2026-08-28-bakers-gift-businesses.md` for the
complete list of what was added and the judgment calls made (a few fields left as `text`
rather than guessed `select` option lists, three templates per vertical skipped as
duplicates of existing `internal_reply_rules`, payment/reminder-date fields deliberately
NOT added as new columns since they map onto existing generic tables). `baker`/`gift` are
now `active = true` in `verticals`. The Launch Acceptance count in CLAUDE.md is 10 (5×2),
content-ready — actual end-to-end testing against each combination is still Build Phase 6
work, not something seeding data accomplishes on its own.
