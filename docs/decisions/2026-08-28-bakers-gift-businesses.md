# Ordrfy Addendum — Bakers & Gift Businesses (Content)

**Status: RECEIVED AND SEEDED (2026-08-28).** This is the source content referenced by
`docs/decisions/2026-08-28-vertical-expansion.md`, which built the schema (`verticals`
table, `vertical_field_definitions`/`order_field_values`) but explicitly could not seed
real content without it. That "still needed" blocker is now resolved — Baker and Gift are
flipped to `active = true` in `seed.sql`.

Confirms the addendum's own instinct: **no architecture change was needed.** Everything
below fits the existing shared-engine mechanisms exactly as designed.

## What was seeded

- **Pipeline stages**: 11 for Baker, 14 for Gift, exactly as specified, as vertical-default
  (`business_id = null`) rows.
- **`vertical_field_definitions`**: 13 for Baker, 17 for Gift (see `seed.sql` for the full
  list) — cake flavour, eggless/egg, design notes, occasion, recipient relationship,
  surprise-required, delivery details, etc.
- **`internal_reply_rules`**: 6 keyword-triggered quick replies for Baker (price, flavour,
  eggless, availability, delivery, custom design), 5 for Gift (recommendation, budget,
  personalization, surprise, delivery).
- **`message_templates`**: 6 reminder-triggering template pairs for Baker (12 rows across
  WhatsApp+Instagram), 7 for Gift (14 rows), plus 9 owner-selectable quick-send milestone
  templates per vertical (18 rows each) — Welcome, Quote Sent, Advance Payment Request,
  Order Confirmation, Preparation Update, Pickup/Ready, Out for Delivery, Delivery
  Confirmation, Thank You.

## Judgment calls made while seeding (flagging rather than silently deciding)

- **Payment fields not duplicated**: the addendum's "Payment" field lists (total amount,
  advance required/received, balance, status, due date) for both verticals map directly
  onto the existing generic `payments` table. Advance received is a partial `amount_paid`;
  balance is `amount_due - amount_paid` computed on the fly. Adding vertical-specific
  payment columns would have directly contradicted the addendum's own "do not duplicate
  generic business logic" principle.
- **Reminder date fields not stored as data**: "quote follow-up date," "advance reminder
  date," etc. aren't `order_field_values` — they're `reminder_type` values on the existing
  `reminders` table (`quote_followup`, `advance_due`, `preparation_deadline`,
  `pickup_reminder`, `delivery_reminder`, `balance_due` for Baker;
  `followup_after_options`, `customization_confirmation`, `advance_due`,
  `preparation_deadline`, `special_date_reminder`, `delivery_reminder`, `balance_due` for
  Gift), with timing configured via `business_settings`, not stored as order data.
- **Three named templates skipped per vertical** to avoid duplication: Baker's "Price
  Information Response" and "Availability Response," and Gift's "Gift Recommendation/
  Options Response," "Budget Information Request," and "Personalization Details Request"
  are not separately seeded into `message_templates` — they're already covered by the
  keyword-triggered `internal_reply_rules` above with equivalent content. Seeding both
  would have created two divergent copies of the same reply.
- **`baker.occasion` is `text`, not `select`**: the addendum lists "Occasion" under Baker's
  order fields without enumerating options (unlike Gift's occasion list, which is fully
  enumerated and *was* built as `select`). Guessing a fixed option list for Baker would risk
  being wrong in a way that's annoying to correct later; free text costs nothing now.
- **`budget_range` (Gift) is `text`, not `select`**: no specific currency brackets were
  given, and guessing bucket boundaries (e.g. "₹500–1000") risks being wrong for real
  Indian gift-business pricing without real customer input — exactly the kind of
  interview-informed decision `pipeline_stages`/`internal_reply_rules` for the original 3
  verticals were built from, per the Build Phase 3 principle.
- **`select_options` are vertical-wide, not per-business**: `vertical_field_definitions` has
  no `business_id` column by design (see `2026-08-28-vertical-expansion.md`). A business
  wanting a different cake-flavour list than the vertical default is a Build Phase 3+ UI
  question (would need a schema change to support), not something this seed pass invented
  an answer for.

## Launch Acceptance status

CLAUDE.md's testing matrix is updated from "10 combinations, pending Baker/Gift content" to
"10 combinations, all content-ready" — actual end-to-end testing against each combination
(including the Baker/Gift-specific scenarios listed in the source addendum: custom cake
inquiry, advance payment pending, pickup vs. delivery, surprise delivery, date-sensitive
birthday/anniversary orders, balance payment reminders, cancellations) still happens at
Build Phase 6, same as the original 3 verticals — seeding content is not the same as having
tested it.
