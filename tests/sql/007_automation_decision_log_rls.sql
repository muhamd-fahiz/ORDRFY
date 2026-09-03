-- Confirms automation_decision_log (docs/architecture/decisions/0035-layered-ai-automation-phase1.md)
-- carries the same tenant isolation as every other table -- Non-Negotiable Architecture Rule 3 --
-- same pattern as 001_rls_isolation.sql, scoped to this one new table.
begin;

create or replace function pg_temp.assert(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not condition then
    raise exception 'ASSERTION FAILED: %', message;
  end if;
end;
$$;

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into businesses (id, name, vertical, subscription_status)
values
  ('a1000000-0000-0000-0000-000000000001', 'ADL Test Biz A', 'fashion', 'active'),
  ('a2000000-0000-0000-0000-000000000002', 'ADL Test Biz B', 'fashion', 'active');

insert into business_memberships (user_id, business_id, role)
values
  ('11111111-1111-1111-1111-111111111111', 'a1000000-0000-0000-0000-000000000001', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'a2000000-0000-0000-0000-000000000002', 'owner');

insert into contacts (id, business_id, name)
values
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Contact A'),
  ('c2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002', 'Contact B');

insert into messages (id, contact_id, business_id, channel_id, direction, provider)
values
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001', (select id from channels where name = 'whatsapp'), 'inbound', 'mock'),
  ('d2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002',
    'a2000000-0000-0000-0000-000000000002', (select id from channels where name = 'whatsapp'), 'inbound', 'mock');

-- action='NEEDS_ATTENTION' (not AUTOMATE_REPLY): this test is about RLS, not about the
-- action/matched_rule_id pairing added later (see 009_automation_decision_log_writer_constraints.sql
-- for that) -- NEEDS_ATTENTION needs no matched_rule_id to satisfy every constraint on this table.
insert into automation_decision_log (message_id, business_id, decision_source, action)
values
  ('d1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'layer1_rules', 'NEEDS_ATTENTION'),
  ('d2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002', 'layer1_rules', 'NEEDS_ATTENTION');

-- Impersonate user A: a member of business A only.
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from automation_decision_log) = 1,
  'user A should see exactly 1 automation_decision_log row total under RLS'
);

select pg_temp.assert(
  (select count(*) from automation_decision_log where business_id = 'a1000000-0000-0000-0000-000000000001') = 1,
  'user A should see their own business''s decision log row'
);

select pg_temp.assert(
  (select count(*) from automation_decision_log where business_id = 'a2000000-0000-0000-0000-000000000002') = 0,
  'user A must NOT see business B''s decision log row via RLS'
);

do $$
declare
  insert_succeeded boolean := false;
begin
  begin
    insert into automation_decision_log (message_id, business_id, decision_source, action)
    values ('d2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'layer1_rules', 'NEEDS_ATTENTION');
    insert_succeeded := true;
  exception when others then
    insert_succeeded := false;
  end;
  if insert_succeeded then
    raise exception 'ASSERTION FAILED: cross-tenant automation_decision_log insert should have been rejected by RLS';
  end if;
end $$;

reset role;

do $$ begin raise notice 'automation_decision_log RLS isolation test: PASSED'; end $$;

rollback;
