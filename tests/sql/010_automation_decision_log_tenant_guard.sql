-- Audit finding #3 (schema) and finding #4 (final hardening pass): confirms
-- trg_guard_automation_decision_log_business_match rejects a row whose business_id doesn't
-- match the actual business_id of the message_id or (non-null, non-vertical-default)
-- matched_rule_id it references -- same pattern as 006_contact_business_integrity_guard.sql,
-- extended to this newer table. Also confirms a vertical-default (shared) rule is ALLOWED for
-- a business of the SAME vertical, but REJECTED for a business of a DIFFERENT vertical --
-- a shared rule is not a cross-tenant leak, but logging it against a business whose own
-- vertical doesn't match the rule's vertical is still a real integrity violation (that rule
-- could never actually have been a legitimate Layer 1/2 candidate for that business).
begin;

create or replace function pg_temp.assert(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not condition then
    raise exception 'ASSERTION FAILED: %', message;
  end if;
end;
$$;

insert into businesses (id, name, vertical, subscription_status)
values
  ('a1000000-0000-0000-0000-000000000001', 'Guard Test Biz A', 'fashion', 'active'),
  ('a2000000-0000-0000-0000-000000000002', 'Guard Test Biz B', 'fashion', 'active');

insert into contacts (id, business_id, name)
values ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Contact A');

insert into messages (id, contact_id, business_id, channel_id, direction, provider)
values (
  'd1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001', (select id from channels where name = 'whatsapp'), 'inbound', 'mock'
);

insert into internal_reply_rules (id, business_id, vertical, rule_key, reply_text)
values
  ('e1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'fashion', 'guard_test_rule_a', 'A reply'),
  ('e2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002', 'fashion', 'guard_test_rule_b', 'B reply'),
  ('e3000000-0000-0000-0000-000000000003', null, 'fashion', 'guard_test_rule_default', 'Default reply'),
  ('e4000000-0000-0000-0000-000000000004', null, 'tutor', 'guard_test_rule_wrong_vertical', 'Tutor default reply');

-- === message_id cross-tenant mismatch ================================================

do $$
declare
  insert_succeeded boolean := false;
begin
  begin
    insert into automation_decision_log (message_id, business_id, decision_source, action)
    values ('d1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'layer1_rules', 'NEEDS_ATTENTION');
    insert_succeeded := true;
  exception when others then
    insert_succeeded := false;
  end;
  if insert_succeeded then
    raise exception 'ASSERTION FAILED: a business_id not matching the referenced message''s real business should have been rejected';
  end if;
end $$;

-- === matched_rule_id cross-tenant mismatch ============================================

do $$
declare
  insert_succeeded boolean := false;
begin
  begin
    insert into automation_decision_log (message_id, business_id, decision_source, action, matched_rule_id)
    values ('d1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'layer1_rules', 'AUTOMATE_REPLY', 'e2000000-0000-0000-0000-000000000002');
    insert_succeeded := true;
  exception when others then
    insert_succeeded := false;
  end;
  if insert_succeeded then
    raise exception 'ASSERTION FAILED: a matched_rule_id belonging to a different business should have been rejected';
  end if;
end $$;

-- === legitimate same-tenant rows are still allowed ====================================

insert into automation_decision_log (message_id, business_id, decision_source, action, matched_rule_id)
values ('d1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'layer1_rules', 'AUTOMATE_REPLY', 'e1000000-0000-0000-0000-000000000001');

select pg_temp.assert(
  (select count(*) from automation_decision_log where business_id = 'a1000000-0000-0000-0000-000000000001') = 1,
  'a same-tenant automation_decision_log row referencing its own business''s rule should have been allowed'
);

-- A vertical-default rule (business_id IS NULL) must be allowed for ANY business -- it is
-- shared, not owned, so referencing it is never a cross-tenant violation.
delete from automation_decision_log where message_id = 'd1000000-0000-0000-0000-000000000001';
insert into automation_decision_log (message_id, business_id, decision_source, action, matched_rule_id)
values ('d1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'layer1_rules', 'AUTOMATE_REPLY', 'e3000000-0000-0000-0000-000000000003');

select pg_temp.assert(
  (select count(*) from automation_decision_log where matched_rule_id = 'e3000000-0000-0000-0000-000000000003') = 1,
  'a reference to a vertical-default (business_id IS NULL) rule should have been allowed'
);

-- === shared rule, WRONG vertical -- must be rejected (audit finding #4) ==============

do $$
declare
  insert_succeeded boolean := false;
begin
  begin
    insert into automation_decision_log (message_id, business_id, decision_source, action, matched_rule_id)
    values ('d1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'layer1_rules', 'AUTOMATE_REPLY', 'e4000000-0000-0000-0000-000000000004');
    insert_succeeded := true;
  exception when others then
    insert_succeeded := false;
  end;
  if insert_succeeded then
    raise exception 'ASSERTION FAILED: a shared rule for a different vertical (tutor) logged against a fashion business should have been rejected';
  end if;
end $$;

do $$ begin raise notice 'automation_decision_log tenant guard trigger test: PASSED'; end $$;

rollback;
