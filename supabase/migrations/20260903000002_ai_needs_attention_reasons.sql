-- Adds the reasons Layer 4's decideAction() (lib/engine/automation-decision.ts) can produce,
-- per docs/architecture/decisions/0035-layered-ai-automation-phase1.md. Purely additive --
-- every existing value stays valid, nothing is removed, so every existing row still
-- satisfies this constraint unchanged. Not written by any code path yet: automation.ts does
-- not call decideAction() in this phase, so no row with any of these four new reasons exists
-- until a later phase wires the call site.
--
-- ai_unavailable is included deliberately, not left out: decideAction()'s own contract can
-- return it (classification=null), so leaving it out of this table now would just mean a
-- second migration the day the call site is wired -- cheaper to add it alongside the other
-- three now than to discover the gap later.
--
-- Constraint name confirmed against the live database before writing this migration
-- (pg_constraint via the running local Postgres instance), not assumed from Postgres's
-- default-naming convention.
alter table owner_attention_queue drop constraint owner_attention_queue_reason_check;
alter table owner_attention_queue add constraint owner_attention_queue_reason_check
  check (reason in (
    'unmatched_message',
    'ambiguous_match',
    'media_message',
    'reminder_channel_unsupported',
    'manual_flag',
    'ai_low_confidence',
    'ai_suggested_needs_review',
    'human_requested',
    'ai_unavailable'
  ));
