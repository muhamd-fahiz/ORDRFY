# ADR-0002: WhatsApp Reminder Templates Locked to Utility Category, Enforced at the Database

**Status:** Accepted (2026-08-28)

## Context

WhatsApp templates must be categorized as Utility, Marketing, or Authentication. Reminders (fee due, payment due, appointment) must always be filed as Utility — cheaper, stricter opt-in rules, less likely to be flagged than Marketing. If a reminder template is ever submitted as, or later reassigned to, a non-Utility category, it costs more and carries different compliance risk than the product is designed around.

## Decision

- `message_templates.category` is a DB-constrained enum: `'utility' | 'marketing' | 'authentication'`. Note: "Service" is not a real template category in Meta's model — it's the free-form, no-template-needed conversation type for replies inside the open window, which `internal_reply_rules` already covers. The enum deliberately excludes it.
- A trigger on `reminders` (`guard_reminder_template_category`, `supabase/migrations/20260828120020_reminder_template_category_guard.sql`) rejects any insert/update that attaches a WhatsApp `message_template_id` whose `category` isn't `utility`. Instagram rows are exempt — they aren't real Meta-approved templates and `category` is nullable for them.

## Alternatives Considered

- **Application-code validation only.** Rejected — a bug or a direct data edit could silently attach a Marketing- or Authentication-category template to the reminder engine with no guard catching it. Enforcing this at the database level means it holds regardless of which code path performs the write.

## Consequences

Still to do (Build Phase 3+, admin panel UI): surface this constraint at template-setup time so a human configuring a vertical's reminder flow gets an immediate, readable error instead of only hitting the DB trigger.
