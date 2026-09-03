-- Confirms the two constraints added by
-- docs/architecture/decisions/0036-phase2-ai-classification-wiring.md (Phase 2 being
-- automation_decision_log's first production writer, per ADR-0035's carry-forward
-- prerequisite #3): action is restricted to DecisionAction's own kind union, and
-- AUTOMATE_REPLY can never be recorded without a matched_rule_id.
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
values ('a1000000-0000-0000-0000-000000000001', 'ADL Constraint Test Biz', 'fashion', 'active');

insert into contacts (id, business_id, name)
values ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Contact A');

insert into messages (id, contact_id, business_id, channel_id, direction, provider)
values
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001', (select id from channels where name = 'whatsapp'), 'inbound', 'mock'),
  ('d2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001', (select id from channels where name = 'whatsapp'), 'inbound', 'mock'),
  ('d3000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001', (select id from channels where name = 'whatsapp'), 'inbound', 'mock'),
  ('d4000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001', (select id from channels where name = 'whatsapp'), 'inbound', 'mock');

insert into internal_reply_rules (id, business_id, vertical, rule_key, reply_text)
values ('e1000000-0000-0000-0000-000000000001', null, 'fashion', 'constraint_test_rule', 'Test reply');

-- === action CHECK ====================================================================

-- Every value in DecisionAction's own kind union must be accepted.
insert into automation_decision_log (message_id, business_id, decision_source, action, matched_rule_id)
values ('d1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'layer1_rules', 'AUTOMATE_REPLY', 'e1000000-0000-0000-0000-000000000001');

do $$
declare
  insert_succeeded boolean := false;
begin
  begin
    insert into automation_decision_log (message_id, business_id, decision_source, action)
    values ('d3000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'layer1_rules', 'NOT_A_REAL_ACTION');
    insert_succeeded := true;
  exception when others then
    insert_succeeded := false;
  end;
  if insert_succeeded then
    raise exception 'ASSERTION FAILED: an unrecognized action value should have been rejected';
  end if;
end $$;

-- === AUTOMATE_REPLY requires matched_rule_id ==========================================

do $$
declare
  insert_succeeded boolean := false;
begin
  begin
    insert into automation_decision_log (message_id, business_id, decision_source, action, matched_rule_id)
    values ('d4000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'layer4_decision', 'AUTOMATE_REPLY', null);
    insert_succeeded := true;
  exception when others then
    insert_succeeded := false;
  end;
  if insert_succeeded then
    raise exception 'ASSERTION FAILED: AUTOMATE_REPLY without a matched_rule_id should have been rejected';
  end if;
end $$;

-- NEEDS_ATTENTION and SUGGEST_REPLY must NOT require a matched_rule_id.
insert into automation_decision_log (message_id, business_id, decision_source, action, matched_rule_id, escalation_reason)
values ('d2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'layer4_decision', 'NEEDS_ATTENTION', null, 'ai_low_confidence');

select pg_temp.assert(
  (select count(*) from automation_decision_log where business_id = 'a1000000-0000-0000-0000-000000000001') = 2,
  'the valid AUTOMATE_REPLY-with-rule and NEEDS_ATTENTION-without-rule rows should both have been accepted'
);

do $$ begin raise notice 'automation_decision_log writer constraint test: PASSED'; end $$;

rollback;
