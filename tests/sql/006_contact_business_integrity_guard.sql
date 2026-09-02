-- Confirms trg_guard_contact_business_match_* (20260902000001) rejects a row on
-- contact_channel_identities, messages, reminders, or payments whose business_id doesn't
-- match the actual business_id of the contact_id it references -- the confirmed cross-tenant
-- integrity gap an independent audit found: nothing before this trigger (not RLS, not a
-- composite FK, not any existing trigger) checked this. Runs as the raw Postgres role, same
-- as 002_pipeline_stage_guard.sql, since this trigger fires for every role -- the point is
-- that it protects even a direct PostgREST/service-role write that bypasses RLS entirely,
-- not just the Next.js app's own (already-correct) routes.
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
values
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Business A Contact'),
  ('c2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002', 'Business B Contact');

-- === contact_channel_identities ===================================================

do $$
declare
  insert_succeeded boolean := false;
begin
  begin
    insert into contact_channel_identities (contact_id, business_id, channel_id, provider_user_id)
    values (
      'c2000000-0000-0000-0000-000000000002', -- Business B's contact
      'a1000000-0000-0000-0000-000000000001', -- Business A's own id
      (select id from channels where name = 'whatsapp'),
      'guard-test-cross-tenant-identity'
    );
    insert_succeeded := true;
  exception when others then
    insert_succeeded := false;
  end;
  if insert_succeeded then
    raise exception 'ASSERTION FAILED: contact_channel_identities insert with a cross-tenant contact_id should have been rejected';
  end if;
end $$;

insert into contact_channel_identities (contact_id, business_id, channel_id, provider_user_id)
values (
  'c1000000-0000-0000-0000-000000000001', -- Business A's own contact
  'a1000000-0000-0000-0000-000000000001',
  (select id from channels where name = 'whatsapp'),
  'guard-test-same-tenant-identity'
);

select pg_temp.assert(
  (select count(*) from contact_channel_identities where provider_user_id = 'guard-test-same-tenant-identity') = 1,
  'a same-tenant contact_channel_identities insert should have been allowed'
);

-- === messages ======================================================================

do $$
declare
  insert_succeeded boolean := false;
begin
  begin
    insert into messages (contact_id, business_id, channel_id, direction, provider)
    values (
      'c2000000-0000-0000-0000-000000000002',
      'a1000000-0000-0000-0000-000000000001',
      (select id from channels where name = 'whatsapp'),
      'outbound',
      'mock'
    );
    insert_succeeded := true;
  exception when others then
    insert_succeeded := false;
  end;
  if insert_succeeded then
    raise exception 'ASSERTION FAILED: messages insert with a cross-tenant contact_id should have been rejected';
  end if;
end $$;

insert into messages (contact_id, business_id, channel_id, direction, provider)
values (
  'c1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  (select id from channels where name = 'whatsapp'),
  'outbound',
  'mock'
);

select pg_temp.assert(
  (select count(*) from messages where contact_id = 'c1000000-0000-0000-0000-000000000001') = 1,
  'a same-tenant messages insert should have been allowed'
);

-- === reminders ======================================================================

do $$
declare
  insert_succeeded boolean := false;
begin
  begin
    insert into reminders (business_id, contact_id, channel_id, reminder_type, scheduled_time_utc, idempotency_key)
    values (
      'a1000000-0000-0000-0000-000000000001',
      'c2000000-0000-0000-0000-000000000002',
      (select id from channels where name = 'whatsapp'),
      'payment_due',
      now(),
      'guard-test-cross-tenant-reminder'
    );
    insert_succeeded := true;
  exception when others then
    insert_succeeded := false;
  end;
  if insert_succeeded then
    raise exception 'ASSERTION FAILED: reminders insert with a cross-tenant contact_id should have been rejected';
  end if;
end $$;

insert into reminders (business_id, contact_id, channel_id, reminder_type, scheduled_time_utc, idempotency_key)
values (
  'a1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  (select id from channels where name = 'whatsapp'),
  'payment_due',
  now(),
  'guard-test-same-tenant-reminder'
);

select pg_temp.assert(
  (select count(*) from reminders where idempotency_key = 'guard-test-same-tenant-reminder') = 1,
  'a same-tenant reminders insert should have been allowed'
);

-- Also confirm an UPDATE that re-points an existing, legitimate row at another tenant's
-- contact is rejected too, not just INSERT.
do $$
declare
  update_succeeded boolean := false;
begin
  begin
    update reminders set contact_id = 'c2000000-0000-0000-0000-000000000002'
    where idempotency_key = 'guard-test-same-tenant-reminder';
    update_succeeded := true;
  exception when others then
    update_succeeded := false;
  end;
  if update_succeeded then
    raise exception 'ASSERTION FAILED: updating reminders.contact_id to a cross-tenant contact should have been rejected';
  end if;
end $$;

-- === payments =======================================================================

do $$
declare
  insert_succeeded boolean := false;
begin
  begin
    insert into payments (business_id, contact_id, amount_due)
    values (
      'a1000000-0000-0000-0000-000000000001',
      'c2000000-0000-0000-0000-000000000002',
      500
    );
    insert_succeeded := true;
  exception when others then
    insert_succeeded := false;
  end;
  if insert_succeeded then
    raise exception 'ASSERTION FAILED: payments insert with a cross-tenant contact_id should have been rejected';
  end if;
end $$;

insert into payments (business_id, contact_id, amount_due)
values (
  'a1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  500
);

select pg_temp.assert(
  (select count(*) from payments where contact_id = 'c1000000-0000-0000-0000-000000000001') = 1,
  'a same-tenant payments insert should have been allowed'
);

do $$ begin raise notice 'Contact/business integrity guard trigger test: PASSED'; end $$;

rollback;
