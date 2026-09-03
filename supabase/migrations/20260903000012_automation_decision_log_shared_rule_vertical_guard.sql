-- Audit finding #4: the tenant guard added for automation_decision_log
-- (20260903000005) correctly rejected a matched_rule_id whose rule belongs to a DIFFERENT
-- business, but for a SHARED rule (internal_reply_rules.business_id IS NULL) it performed no
-- check at all. A shared rule is valid for any business, but only of the matching vertical --
-- logging a 'tutor' vertical shared rule against a 'fashion' business is a real data
-- integrity violation (this AI-classification-selected rule could never actually have been a
-- legitimate candidate for that business, per lib/engine/automation.ts's own
-- vertical-filtered rule query), even though it isn't a cross-tenant leak. This does NOT
-- duplicate the full candidate-selection engine (vertical + language + active filtering) in
-- the database -- only the one integrity invariant a trigger can cheaply and meaningfully
-- enforce: which vertical a shared rule belongs to versus which vertical the logging
-- business actually is. Language and active-status are correctly left to the application
-- boundary (lib/ai/validation.ts's enforceCandidateRuleBoundary, fed by
-- lib/engine/automation.ts's own already-filtered query), per the project owner's explicit
-- instruction not to duplicate that engine in triggers without a real integrity requirement.
create or replace function guard_automation_decision_log_business_match()
returns trigger as $$
declare
  message_business_id uuid;
  rule_business_id uuid;
  rule_vertical text;
  logging_business_vertical text;
begin
  select business_id into message_business_id from messages where id = new.message_id;
  if not found then
    raise exception 'automation_decision_log: message_id % does not exist', new.message_id;
  end if;
  if message_business_id != new.business_id then
    raise exception 'automation_decision_log: message_id % belongs to business %, not %',
      new.message_id, message_business_id, new.business_id;
  end if;

  if new.matched_rule_id is not null then
    select business_id, vertical into rule_business_id, rule_vertical
      from internal_reply_rules where id = new.matched_rule_id;
    if not found then
      raise exception 'automation_decision_log: matched_rule_id % does not exist', new.matched_rule_id;
    end if;

    if rule_business_id is not null then
      if rule_business_id != new.business_id then
        raise exception 'automation_decision_log: matched_rule_id % belongs to business %, not %',
          new.matched_rule_id, rule_business_id, new.business_id;
      end if;
    else
      select vertical into logging_business_vertical from businesses where id = new.business_id;
      if logging_business_vertical is distinct from rule_vertical then
        raise exception 'automation_decision_log: matched_rule_id % is a shared rule for vertical %, but business % is vertical %',
          new.matched_rule_id, rule_vertical, new.business_id, logging_business_vertical;
      end if;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;
