-- Confirms trg_guard_contact_pipeline_stage (20260828120018) rejects a contact being
-- assigned a pipeline_stage_id that belongs to a different business, or to a vertical-default
-- stage for the wrong vertical -- even though nothing else in this script uses RLS, this
-- trigger fires for every role, so it protects against an application bug too, not just a
-- malicious tenant.
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
  ('d1000000-0000-0000-0000-000000000001', 'Guard Test Biz Fashion', 'fashion', 'active'),
  ('d2000000-0000-0000-0000-000000000002', 'Guard Test Biz Tutor', 'tutor', 'active'),
  ('d3000000-0000-0000-0000-000000000003', 'Guard Test Biz Other Owner', 'fashion', 'active');

insert into pipeline_stages (id, business_id, vertical, stage_key, stage_label, sort_order)
values
  ('e1000000-0000-0000-0000-000000000001', null, 'fashion', 'guard_test_fashion_default', 'Fashion Default', 900),
  ('e2000000-0000-0000-0000-000000000002', null, 'tutor', 'guard_test_tutor_default', 'Tutor Default', 900),
  ('e3000000-0000-0000-0000-000000000003', 'd3000000-0000-0000-0000-000000000003', 'fashion', 'guard_test_biz_specific', 'Biz-Specific', 900);

insert into contacts (id, business_id, name)
values ('f1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Guard Test Contact');

-- Valid: fashion business gets a fashion vertical-default stage.
update contacts set pipeline_stage_id = 'e1000000-0000-0000-0000-000000000001'
where id = 'f1000000-0000-0000-0000-000000000001';

select pg_temp.assert(
  (select pipeline_stage_id from contacts where id = 'f1000000-0000-0000-0000-000000000001')
    = 'e1000000-0000-0000-0000-000000000001',
  'a same-vertical default stage assignment should have been allowed'
);

-- Invalid: fashion business assigned a tutor vertical-default stage -- must raise.
do $$
declare
  update_succeeded boolean := false;
begin
  begin
    update contacts set pipeline_stage_id = 'e2000000-0000-0000-0000-000000000002'
    where id = 'f1000000-0000-0000-0000-000000000001';
    update_succeeded := true;
  exception when others then
    update_succeeded := false;
  end;
  if update_succeeded then
    raise exception 'ASSERTION FAILED: assigning a tutor-vertical default stage to a fashion contact should have been rejected';
  end if;
end $$;

-- Invalid: fashion business assigned a stage that belongs to a different business -- must raise.
do $$
declare
  update_succeeded boolean := false;
begin
  begin
    update contacts set pipeline_stage_id = 'e3000000-0000-0000-0000-000000000003'
    where id = 'f1000000-0000-0000-0000-000000000001';
    update_succeeded := true;
  exception when others then
    update_succeeded := false;
  end;
  if update_succeeded then
    raise exception 'ASSERTION FAILED: assigning a different business''s own pipeline stage should have been rejected';
  end if;
end $$;

select pg_temp.assert(
  (select pipeline_stage_id from contacts where id = 'f1000000-0000-0000-0000-000000000001')
    = 'e1000000-0000-0000-0000-000000000001',
  'contact''s stage must remain the last successfully-assigned value after two rejected updates'
);

do $$ begin raise notice 'Pipeline stage guard trigger test: PASSED'; end $$;

rollback;
