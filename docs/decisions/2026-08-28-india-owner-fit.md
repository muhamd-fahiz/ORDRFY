# Ordrfy Addendum — India Micro-Business Owner Fit

**Status: ACCEPTED (2026-08-28).** Read alongside CLAUDE.md and the prior addenda. Focus:
friction points specific to Ordrfy's actual user base — small Indian businesses, frequently
run by an owner using their own personal phone, communicating with customers in mixed
languages.

## 10. Multi-language support from day one (English + Hindi ship first)

**Built:**
- `internal_reply_rules` and `message_templates` both gain a `language` column (default
  `en`), and their unique constraints widen to include it —
  `unique(business_id, vertical, rule_key, language)` and
  `unique(business_id, vertical, channel_id, template_key, language)` respectively. The
  same `rule_key`/`template_key` can now have one row per language instead of forcing mixed
  content into one row.
- `businesses` gains `preferred_language` (default `en`). **Deviation from the literal
  recommendation text**: the addendum suggested this live in `business_settings`; it's
  built as a first-class column on `businesses` instead, alongside `vertical` and
  `timezone` — it's as fundamental to a business's identity as those two, not an optional
  override of a numeric/behavioral default the way `payment_reminder_delay_days` is.
- Neither column is a `CHECK`-constrained enum of specific languages — which languages are
  "supported" is simply a function of which `internal_reply_rules`/`message_templates` rows
  exist for that language code, not a hardcoded list. Only `en` is seeded at launch; adding
  `hi` (or any other language) later is new rows, not a migration.

**Deferred to Build Phase 2/3**: the actual matching logic preferring
`businesses.preferred_language`, falling back to `en` when no row exists in that language
for a matched `rule_key`/`template_key`.

## 11. Detect and honor WhatsApp opt-outs automatically

**Built:**
- `contact_channel_identities.opted_out_at` (nullable, per-channel — opting out on WhatsApp
  doesn't imply opting out on Instagram too).
- `opt_out_keywords` table: business-overridable (nullable `business_id` = global default),
  language-aware phrase list, seeded with common English + Hindi phrases at launch.

**Deferred to Build Phase 2**: the actual detection logic (checked against every inbound
message *before* `internal_reply_rules` matching — an opt-out always wins over any other
automation match), and folding `opted_out_at` into the reminder engine's send-eligibility
check as one more data-driven condition alongside the WhatsApp-consent and Instagram-window
checks from `docs/decisions/2026-08-28-instagram-whatsapp-consent-routing.md` — not a
separate code path. On detection: set `opted_out_at`, log to `activity_log` so the owner
understands why sends silently stopped rather than assuming a bug.

## 12. Make the WhatsApp Business App → API tradeoff explicit during onboarding

**Decision**: no schema or engine change. This is a content/flow requirement — an explicit
onboarding screen, before any number is connected, surfacing that moving a number onto the
API typically means giving up the free consumer WhatsApp Business App on that number, and
guiding the business toward either a second number or an informed accept. Belongs in Build
Phase 4 (real provider integration), before real `InteraktAdapter` onboarding is exposed to
actual businesses.

## 13. Keep the owner's daily, repeated actions to one tap, not a form

**Decision**: no schema change — the schema already supports it (marking a payment fully
paid, or moving a pipeline stage, is already a single-field update once the amount/stage is
known). This is a UI/interaction-design constraint for Build Phase 3+ (dashboard build):
routine, high-frequency actions (mark paid, advance pipeline stage, dismiss an
`owner_attention_queue` item) must be completable in one tap wherever the action doesn't
inherently require more input. This applies *within* the existing "functional only" admin
UI scope — it's about reducing repeated operational load, not visual polish, so it isn't
exempted by that scope decision.

## Summary of build impact

| Item | Schema built now | Behavior/logic phase |
|---|---|---|
| 10. Multi-language | Yes (`language` columns, `preferred_language`) | Build Phase 2/3 |
| 11. WhatsApp opt-out | Yes (`opted_out_at`, `opt_out_keywords`) | Build Phase 2 |
| 12. App→API onboarding disclosure | No (content/flow only) | Build Phase 4 |
| 13. Single-tap owner actions | No (schema already supports it) | Build Phase 3+ |
