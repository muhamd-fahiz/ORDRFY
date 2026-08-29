# ADR-0010: Generic Vertical-Specific Order Fields via `vertical_field_definitions`

**Status:** Accepted (2026-08-28); content validated same-day against real Baker/Gift requirements.

## Context

Fashion and Tutor's original scope never needed a flexible "order details" concept. The Baker and Gift verticals (see ADR-0009 for the scope-expansion decision they're part of) introduce many fields that don't fit the existing schema at all — cake flavour, eggless/egg, custom design notes, occasion, recipient relationship, personalization text, surprise-delivery flag, budget range, delivery address — and these differ per vertical. Bolting them onto `contacts`/`payments` as new nullable columns per vertical would scatter per-vertical special-casing into the shared tables — the same anti-pattern the "no vertical conditionals in shared-engine code" rule prevents, just at the schema level.

## Decision

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

Exactly one `value_*` column is populated per row, matching the referenced field's `field_type` — enforced at the application layer (Build Phase 3), not a DB CHECK.

`vertical_field_definitions` has no `business_id` column by design — field definitions are vertical-wide, not per-business.

## Alternatives Considered

- **A single `jsonb` column on `contacts`.** Rejected — jsonb can't enforce required fields, validate `select` options, or support an indexed query like "all orders with `surprise_required = true` due this week," which the Gift dashboard explicitly needs. A structured table over jsonb was a deliberate choice specifically for these three properties.
- **A business-specific override of `select_options`** (e.g. a different cake-flavour list per business). Not built — this is a Build Phase 3+ UI question that would need a schema change to support, not something the initial seed pass invented an answer for.

## Consequences

Migration placement note: the source request suggested slotting this migration adjacent to `pipeline_stages`; by the time it was built, several other migrations (0019–0023, covering consent routing, template category guard, system health, owner attention queue) had already claimed that numeric range. `vertical_field_definitions`/`order_field_values` only depend on `contacts` (0008) and `verticals` (0000, ADR-0009) existing, both satisfied well before this migration's actual position at 0024 — functionally equivalent, just not numerically adjacent to `pipeline_stages` anymore.

## Notes

**Baker and Gift content, seeded same-day.** Confirms the mechanism's own premise: no architecture change was needed to onboard two new verticals' real content. Seeded: 11 pipeline stages for Baker, 14 for Gift (vertical-default rows); 13 `vertical_field_definitions` for Baker, 17 for Gift; 6 keyword-triggered `internal_reply_rules` for Baker, 5 for Gift; 6 reminder-triggering template pairs for Baker (12 rows across WhatsApp+Instagram), 7 for Gift (14 rows), plus 9 owner-selectable quick-send milestone templates per vertical (18 rows each). `baker`/`gift` flipped to `active = true` in `verticals` once this landed.

Judgment calls made while seeding, flagged rather than silently decided:
- Payment fields (total amount, advance required/received, balance, status, due date) were **not** duplicated as vertical-specific columns — they map directly onto the existing generic `payments` table (advance received is a partial `amount_paid`; balance is `amount_due - amount_paid` computed on the fly). Adding vertical-specific payment columns would have contradicted the "don't duplicate generic business logic" principle this whole mechanism exists to uphold.
- Reminder-date concepts ("quote follow-up date," "advance reminder date," etc.) are **not** `order_field_values` — they're `reminder_type` values on the existing `reminders` table, with timing configured via `business_settings`, not stored as order data.
- Three named templates were skipped per vertical to avoid duplication (Baker's Price/Availability responses, Gift's Recommendation/Budget/Personalization responses) — they're already covered by equivalent `internal_reply_rules` content; seeding both would have created two divergent copies of the same reply.
- `baker.occasion` is `text`, not `select` (no enumerated option list was specified for Baker, unlike Gift's fully-enumerated occasion list) — guessing a fixed option list risks being wrong in a way that's annoying to correct later; free text costs nothing now.
- `budget_range` (Gift) is `text`, not `select` — no specific currency brackets were given, and guessing bucket boundaries (e.g. "₹500–1000") risks being wrong for real Indian gift-business pricing without real customer input.

Actual end-to-end testing against each of the 10 vertical×channel combinations (including Baker/Gift-specific scenarios: custom cake inquiry, advance payment pending, pickup vs. delivery, surprise delivery, date-sensitive birthday/anniversary orders, balance payment reminders, cancellations) is still Build Phase 6 work — seeding content is not the same as having tested it.
