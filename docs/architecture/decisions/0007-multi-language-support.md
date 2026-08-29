# ADR-0007: Multi-Language Support via `language` Columns and `businesses.preferred_language`

**Status:** Accepted (2026-08-28)

## Context

Ordrfy's actual user base — small Indian businesses, frequently run by an owner using their own personal phone — communicates with customers in mixed languages. English-only automation content would misfire for a large share of real conversations from day one.

## Decision

- `internal_reply_rules` and `message_templates` both gain a `language` column (default `en`), and their unique constraints widen to include it: `unique(business_id, vertical, rule_key, language)` and `unique(business_id, vertical, channel_id, template_key, language)` respectively. The same `rule_key`/`template_key` can now have one row per language instead of forcing mixed content into one row.
- `businesses` gains `preferred_language` (default `en`) as a first-class column, alongside `vertical` and `timezone`.
- Neither column is a `CHECK`-constrained enum of specific languages — which languages are "supported" is simply a function of which `internal_reply_rules`/`message_templates` rows exist for that language code, not a hardcoded list. Only `en` is seeded at launch; adding `hi` (or any other language) later is new rows, not a migration.

## Alternatives Considered

- **Store `preferred_language` as a `business_settings` key** (the originally suggested location). Rejected — it's as fundamental to a business's identity as `vertical` or `timezone`, not an optional override of a numeric/behavioral default the way `payment_reminder_delay_days` is. Built as a first-class column instead.
- **A `CHECK`-constrained language enum.** Rejected for the same reason `verticals` moved off a hardcoded `CHECK` list (see ADR-0009) — it would require a migration to add a language, when the real constraint that matters is "does content exist for this language," which the actual rule/template rows already express.

## Consequences

Deferred to Build Phase 2/3: the actual matching logic preferring `businesses.preferred_language`, falling back to `en` when no row exists in that language for a matched `rule_key`/`template_key`.
