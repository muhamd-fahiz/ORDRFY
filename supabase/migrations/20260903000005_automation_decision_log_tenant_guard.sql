-- Audit finding #3: automation_decision_log carries business_id, message_id, and
-- matched_rule_id, but nothing checked that the referenced message or rule actually belongs
-- to the stated business -- the same class of gap
-- 20260902000001_contact_business_integrity_guard.sql already closed for
-- contact_channel_identities/messages/reminders/payments, extended here to this newer table.
--
-- matched_rule_id is handled differently from message_id: internal_reply_rules.business_id
-- may legitimately be NULL (a vertical-wide default rule, valid for any business of that
-- vertical) -- only a NON-NULL mismatch is a real cross-tenant violation. A plain "must
-- equal" check would incorrectly reject every legitimate vertical-default rule reference.
create or replace function guard_automation_decision_log_business_match()
returns trigger as $$
declare
  message_business_id uuid;
  rule_business_id uuid;
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
    select business_id into rule_business_id from internal_reply_rules where id = new.matched_rule_id;
    if not found then
      raise exception 'automation_decision_log: matched_rule_id % does not exist', new.matched_rule_id;
    end if;
    if rule_business_id is not null and rule_business_id != new.business_id then
      raise exception 'automation_decision_log: matched_rule_id % belongs to business %, not %',
        new.matched_rule_id, rule_business_id, new.business_id;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_guard_automation_decision_log_business_match
  before insert or update of message_id, business_id, matched_rule_id on automation_decision_log
  for each row execute function guard_automation_decision_log_business_match();
