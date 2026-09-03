-- Phase 2 (docs/architecture/decisions/0036-phase2-ai-classification-wiring.md) is
-- automation_decision_log's first production writer -- the trigger ADR-0035's
-- carry-forward prerequisite #3 named for revisiting these two deferred constraints against
-- the writer's actual lifecycle. Both are additive/tightening only; every row this phase can
-- possibly write already satisfies both.
--
-- action now matches DecisionAction's own kind union exactly (lib/engine/automation-decision.ts) --
-- deferred in Phase 1 only because there was no writer yet to validate against.
alter table automation_decision_log add constraint automation_decision_log_action_check
  check (action in ('AUTOMATE_REPLY', 'SUGGEST_REPLY', 'NEEDS_ATTENTION'));

-- Concrete database-level enforcement of the single most important safety invariant in the
-- whole layered design -- "never auto-reply without a concrete matched rule" -- so it holds
-- even against a future bug that bypasses decideAction()'s own in-memory check entirely.
-- Not attempting broader AI-metadata consistency constraints (e.g. confidence non-null iff
-- capability non-null): the actual writer lifecycle analyzed in ADR-0036 already produces
-- that pairing correctly by construction, so a DB constraint enforcing it would be
-- redundant defense without a corresponding real risk.
alter table automation_decision_log add constraint automation_decision_log_auto_reply_needs_rule
  check (action <> 'AUTOMATE_REPLY' or matched_rule_id is not null);
