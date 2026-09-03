-- Confirms the two CHECK constraints added by
-- docs/architecture/decisions/0035-layered-ai-automation-phase1.md behave as designed:
-- owner_attention_queue.reason accepts the four new AI-attention values without disturbing
-- the original five, and business_settings.setting_value is validated only for
-- setting_key='automation_mode', leaving every other key free-form exactly as before.
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
values ('a1000000-0000-0000-0000-000000000001', 'Constraint Test Biz', 'fashion', 'active');

insert into contacts (id, business_id, name)
values ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Contact A');

-- === owner_attention_queue.reason ====================================================

-- Every pre-existing value must still be accepted.
insert into owner_attention_queue (business_id, contact_id, reason, reference_type)
values ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'unmatched_message', 'message');

-- Every new AI-attention value must be accepted.
insert into owner_attention_queue (business_id, contact_id, reason, reference_type)
values
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'ai_low_confidence', 'message'),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'ai_suggested_needs_review', 'message'),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'human_requested', 'message'),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'ai_unavailable', 'message');

select pg_temp.assert(
  (select count(*) from owner_attention_queue where business_id = 'a1000000-0000-0000-0000-000000000001') = 5,
  'all five pre-existing-plus-new reason values should have been accepted'
);

-- An unrecognized value must still be rejected.
do $$
declare
  insert_succeeded boolean := false;
begin
  begin
    insert into owner_attention_queue (business_id, contact_id, reason, reference_type)
    values ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'not_a_real_reason', 'message');
    insert_succeeded := true;
  exception when others then
    insert_succeeded := false;
  end;
  if insert_succeeded then
    raise exception 'ASSERTION FAILED: an unrecognized owner_attention_queue.reason value should have been rejected';
  end if;
end $$;

-- === business_settings.setting_value, key = automation_mode ==========================

insert into business_settings (business_id, setting_key, setting_value)
values ('a1000000-0000-0000-0000-000000000001', 'automation_mode', 'smart');

do $$
declare
  insert_succeeded boolean := false;
begin
  begin
    insert into business_settings (business_id, setting_key, setting_value)
    values ('a1000000-0000-0000-0000-000000000001', 'automation_mode', 'super_intelligent_mode');
    insert_succeeded := true;
  exception when others then
    insert_succeeded := false;
  end;
  if insert_succeeded then
    raise exception 'ASSERTION FAILED: an unrecognized automation_mode value should have been rejected';
  end if;
end $$;

-- Audit finding #4: setting_value IS NULL must be explicitly rejected too. The original
-- constraint (`setting_value in (...)`) evaluates to NULL, not FALSE, when setting_value IS
-- NULL -- and a CHECK only rejects a FALSE result, so a NULL value previously slipped
-- through undetected. This is the regression test for that fix.
do $$
declare
  insert_succeeded boolean := false;
begin
  begin
    insert into business_settings (business_id, setting_key, setting_value)
    values ('a1000000-0000-0000-0000-000000000001', 'automation_mode', null);
    insert_succeeded := true;
  exception when others then
    insert_succeeded := false;
  end;
  if insert_succeeded then
    raise exception 'ASSERTION FAILED: a NULL automation_mode value should have been rejected';
  end if;
end $$;

-- The constraint must not affect any other setting_key -- free-form values, including NULL,
-- stay allowed for keys other than automation_mode.
insert into business_settings (business_id, setting_key, setting_value)
values ('a1000000-0000-0000-0000-000000000001', 'trial_grace_period_days', 'not-a-number-but-still-allowed');

select pg_temp.assert(
  (select count(*) from business_settings where business_id = 'a1000000-0000-0000-0000-000000000001') = 2,
  'automation_mode=smart and the unrelated setting_key should both have been accepted'
);

do $$ begin raise notice 'automation_mode and attention-reason constraint test: PASSED'; end $$;

rollback;
