-- Confirms the Pre-Phase 7 P0 remediation (20260905000001_control_plane_rls_tightening.sql):
-- a tenant owner can no longer write control-plane/audit fields on their own business that
-- the architecture reserves for admin/service-role control, while every legitimate owner
-- write path this codebase actually ships keeps working exactly as before.
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
  ('30000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002');

insert into businesses (id, name, phone, email, vertical, subscription_status, automation_paused, timezone, preferred_language)
values
  ('31000000-0000-0000-0000-000000000001', 'RLS Tighten Test Biz', '+910000000091', 'rls-tighten@example.com', 'fashion', 'trial', true, 'Asia/Kolkata', 'en');

insert into business_memberships (user_id, business_id, role)
values ('30000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'owner');

insert into contacts (id, business_id, name)
values ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'Guard Test Contact');

insert into messages (id, contact_id, business_id, channel_id, direction, content, provider, provider_message_id)
values (
  '33000000-0000-0000-0000-000000000001',
  '32000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  (select id from channels where name = 'whatsapp'),
  'inbound',
  'test message',
  'mock-whatsapp',
  'rls-tighten-test-msg-1'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- --- businesses: owner-editable profile fields still work ---
update businesses set name = 'Renamed by Owner', phone = '+910000000099'
where id = '31000000-0000-0000-0000-000000000001';

select pg_temp.assert(
  (select name from businesses where id = '31000000-0000-0000-0000-000000000001') = 'Renamed by Owner',
  'owner must still be able to update their own business profile fields (Settings regression)'
);

-- --- businesses: control-plane fields must be rejected by the new trigger ---
do $$
declare update_succeeded boolean := false;
begin
  begin
    update businesses set automation_paused = false where id = '31000000-0000-0000-0000-000000000001';
    update_succeeded := true;
  exception when others then
    update_succeeded := false;
  end;
  if update_succeeded then
    raise exception 'ASSERTION FAILED: owner must not be able to clear the admin kill switch on their own business';
  end if;
end $$;

do $$
declare update_succeeded boolean := false;
begin
  begin
    update businesses set subscription_status = 'active' where id = '31000000-0000-0000-0000-000000000001';
    update_succeeded := true;
  exception when others then
    update_succeeded := false;
  end;
  if update_succeeded then
    raise exception 'ASSERTION FAILED: owner must not be able to self-grant an active subscription status';
  end if;
end $$;

do $$
declare update_succeeded boolean := false;
begin
  begin
    update businesses set vertical = 'baker' where id = '31000000-0000-0000-0000-000000000001';
    update_succeeded := true;
  exception when others then
    update_succeeded := false;
  end;
  if update_succeeded then
    raise exception 'ASSERTION FAILED: owner must not be able to reassign their own business''s vertical';
  end if;
end $$;

select pg_temp.assert(
  (select automation_paused from businesses where id = '31000000-0000-0000-0000-000000000001') = true
  and (select subscription_status from businesses where id = '31000000-0000-0000-0000-000000000001') = 'trial'
  and (select vertical from businesses where id = '31000000-0000-0000-0000-000000000001') = 'fashion',
  'control-plane fields must remain unchanged after three rejected update attempts'
);

-- --- business_settings / business_entitlements / business_channel_connections: read-only ---
do $$
declare insert_succeeded boolean := false;
begin
  begin
    insert into business_settings (business_id, setting_key, setting_value)
    values ('31000000-0000-0000-0000-000000000001', 'automation_mode', 'smart');
    insert_succeeded := true;
  exception when others then
    insert_succeeded := false;
  end;
  if insert_succeeded then
    raise exception 'ASSERTION FAILED: owner must not be able to self-enable smart automation_mode';
  end if;
end $$;

do $$
declare insert_succeeded boolean := false;
begin
  begin
    insert into business_entitlements (business_id, entitlement_key, active)
    values ('31000000-0000-0000-0000-000000000001', 'channel:whatsapp', true);
    insert_succeeded := true;
  exception when others then
    insert_succeeded := false;
  end;
  if insert_succeeded then
    raise exception 'ASSERTION FAILED: owner must not be able to self-grant an entitlement';
  end if;
end $$;

do $$
declare insert_succeeded boolean := false;
begin
  begin
    insert into business_channel_connections (business_id, channel_id, provider_account_id, connected)
    values ('31000000-0000-0000-0000-000000000001', (select id from channels where name = 'whatsapp'), 'fake-account', true);
    insert_succeeded := true;
  exception when others then
    insert_succeeded := false;
  end;
  if insert_succeeded then
    raise exception 'ASSERTION FAILED: owner must not be able to self-activate a channel connection';
  end if;
end $$;

-- --- activity_log: INSERT still works (many real routes depend on this)... ---
insert into activity_log (business_id, contact_id, event_type, actor_user_id)
values ('31000000-0000-0000-0000-000000000001', '32000000-0000-0000-0000-000000000001', 'attention_resolved', '30000000-0000-0000-0000-000000000001');

select pg_temp.assert(
  (select count(*) from activity_log where business_id = '31000000-0000-0000-0000-000000000001' and event_type = 'attention_resolved') = 1,
  'owner-triggered activity_log INSERT must still succeed (regression for attention/resolve, mark-paid, settings, the automation engine, etc.)'
);

-- --- ...but forging a different actor_user_id must be rejected ---
do $$
declare insert_succeeded boolean := false;
begin
  begin
    insert into activity_log (business_id, event_type, actor_user_id)
    values ('31000000-0000-0000-0000-000000000001', 'payment_marked_paid', '30000000-0000-0000-0000-000000000002');
    insert_succeeded := true;
  exception when others then
    insert_succeeded := false;
  end;
  if insert_succeeded then
    raise exception 'ASSERTION FAILED: owner must not be able to forge a different actor_user_id on an activity_log row';
  end if;
end $$;

-- --- activity_log: append-only -- UPDATE/DELETE must be rejected ---
-- With RLS enabled and no policy granting UPDATE to the tenant role, the statement does not
-- raise -- it silently matches zero rows (the same "for all with no explicit with check"
-- caveat 001_rls_isolation.sql's own UPDATE test already documents). So this checks the row
-- content is unchanged, not that an exception was thrown.
do $$
declare update_succeeded boolean := false;
begin
  begin
    update activity_log set event_type = 'tampered' where business_id = '31000000-0000-0000-0000-000000000001';
    if (select count(*) from activity_log where business_id = '31000000-0000-0000-0000-000000000001' and event_type = 'tampered') > 0 then
      update_succeeded := true;
    end if;
  exception when others then
    update_succeeded := false;
  end;
  if update_succeeded then
    raise exception 'ASSERTION FAILED: owner must not be able to UPDATE their own activity_log rows';
  end if;
end $$;

do $$
declare delete_succeeded boolean := false;
begin
  begin
    delete from activity_log where business_id = '31000000-0000-0000-0000-000000000001';
    -- A DELETE that matches zero rows (because RLS filters the target set to nothing) does
    -- NOT raise -- it just affects 0 rows. So this branch checks the row count directly
    -- rather than relying on an exception.
    if (select count(*) from activity_log where business_id = '31000000-0000-0000-0000-000000000001') = 0 then
      delete_succeeded := true;
    end if;
  exception when others then
    delete_succeeded := false;
  end;
  if delete_succeeded then
    raise exception 'ASSERTION FAILED: owner must not be able to DELETE their own activity_log rows';
  end if;
end $$;

-- --- automation_decision_log: INSERT still works, UPDATE/DELETE rejected ---
-- action='NEEDS_ATTENTION' (not AUTOMATE_REPLY) -- automation_decision_log_auto_reply_needs_rule
-- requires a matched_rule_id for AUTOMATE_REPLY, which is irrelevant to what this test is
-- actually verifying (RLS operation permissions, not decision-log content validation).
insert into automation_decision_log (message_id, business_id, decision_source, action, escalation_reason)
values ('33000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'layer1_rules', 'NEEDS_ATTENTION', 'unmatched_message');

select pg_temp.assert(
  (select count(*) from automation_decision_log where business_id = '31000000-0000-0000-0000-000000000001') = 1,
  'owner-triggered automation_decision_log INSERT must still succeed (regression for the automation engine''s RLS-client call path)'
);

do $$
declare update_succeeded boolean := false;
begin
  begin
    update automation_decision_log set escalation_reason = 'ambiguous_match' where business_id = '31000000-0000-0000-0000-000000000001';
    if (select count(*) from automation_decision_log where business_id = '31000000-0000-0000-0000-000000000001' and escalation_reason = 'ambiguous_match') > 0 then
      update_succeeded := true;
    end if;
  exception when others then
    update_succeeded := false;
  end;
  if update_succeeded then
    raise exception 'ASSERTION FAILED: owner must not be able to UPDATE their own automation_decision_log rows';
  end if;
end $$;

do $$
declare delete_succeeded boolean := false;
begin
  begin
    delete from automation_decision_log where business_id = '31000000-0000-0000-0000-000000000001';
    if (select count(*) from automation_decision_log where business_id = '31000000-0000-0000-0000-000000000001') = 0 then
      delete_succeeded := true;
    end if;
  exception when others then
    delete_succeeded := false;
  end;
  if delete_succeeded then
    raise exception 'ASSERTION FAILED: owner must not be able to DELETE their own automation_decision_log rows';
  end if;
end $$;

-- --- reads must still work for every table (regression: this is not a read regression) ---
select pg_temp.assert(
  (select count(*) from business_settings) = 0
  and (select count(*) from business_entitlements) = 0
  and (select count(*) from business_channel_connections) = 0,
  'owner SELECT on the three read-only tables must still succeed (returning zero rows here, since none exist for this fixture business -- the point is the query itself does not error)'
);

reset role;

do $$ begin raise notice 'Control-plane RLS tightening test: PASSED'; end $$;

rollback;
