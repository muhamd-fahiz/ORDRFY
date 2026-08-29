# ADR-0009: `verticals` Reference Table Replaces Hardcoded CHECK Lists

**Status:** Accepted (2026-08-28)

## Context

The scope expansion from 3 verticals (Fashion, Tutor, Appointment-Based Service) to 5 (adding Baker/Custom Cake and Personalized/Surprise Gift) was the project owner's direct scope decision — addressed the same way the original 3-verticals-together decision was, as a deliberate business call, not something to push back on architecturally.

Implementing it exposed a problem not mentioned in the source scope-expansion request itself: `vertical` was independently hardcoded as `text check (vertical in ('fashion','tutor','service'))` on **five** separate tables (`businesses`, `pipeline_stages`, `internal_reply_rules`, `message_templates`, and the new `vertical_field_definitions` from ADR-0010). Expanding to 5 verticals meant either editing all five CHECK lists by hand now, or fixing the underlying pattern — and leaving the other four tables requiring a migration to add a vertical would have directly contradicted ADR-0010's own stated goal ("adding a 6th vertical later means inserting rows, not writing a migration") the moment any *other* table's vertical set needed to change too.

## Decision

A `verticals` reference table (`key text primary key`, `label`, `active`, `created_at`) — exactly analogous to the existing `channels` table (`supabase/migrations/20260828120000_verticals.sql`). Every `vertical text check (...)` column across all five tables now `references verticals(key)` instead of a hardcoded list. `vertical` stays a plain `text` column everywhere it already was — including the pipeline-stage guard trigger's direct text comparison and every literal string in `seed.sql` — only the validation mechanism changed, from a hardcoded list to a real table, minimizing ripple into already-built logic.

Seeded: `fashion`/`tutor`/`service` as `active = true` from the start; `baker`/`gift` inserted as `active = false` initially — they exist so other tables can reference them, but weren't ready for a business to be assigned to them until their real pipeline/template content was seeded (resolved same-day, see ADR-0010's Notes).

## Alternatives Considered

- **Edit all five CHECK lists by hand for this expansion, and again for any future one.** Rejected — directly undermines the whole point of treating vertical differences as configuration data rather than code, the same reasoning that makes `pipeline_stages`/`internal_reply_rules`/`message_templates` config tables in the first place.
- **A `uuid` foreign key instead of keeping `vertical` as text.** Rejected — would have required touching every existing text comparison (the pipeline-stage guard trigger, every `seed.sql` literal) for no functional benefit; the reference-table constraint achieves the same integrity guarantee without that ripple.

## Consequences

Adding a 6th vertical in the future is an insert into `verticals` plus real content in `pipeline_stages`/`internal_reply_rules`/`message_templates` — never a schema migration to widen a CHECK list.
