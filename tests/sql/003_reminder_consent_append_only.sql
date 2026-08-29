-- Confirms trg_reminder_channel_consent_append_only (20260828120019) rejects UPDATE/DELETE
-- on reminder_channel_consent for every role, including postgres itself here -- this is a
-- BEFORE trigger, not an RLS policy, so RLS bypass (e.g. service_role in the real app) does
-- not bypass it. DPDP Act compliance depends on this being a hard database-level guarantee,
-- not application discipline (docs/architecture/decisions/0003-append-only-reminder-channel-consent.md).
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
values ('9a000000-0000-0000-0000-000000000001', 'Consent Guard Test Biz', 'fashion', 'active');

insert into contacts (id, business_id, name)
values ('9b000000-0000-0000-0000-000000000002', '9a000000-0000-0000-0000-000000000001', 'Consent Guard Contact');

-- created_at is set explicitly (rather than left to its now() default) because now() is
-- frozen for the lifetime of this whole transaction in Postgres -- two default-now() inserts
-- in the same BEGIN/ROLLBACK block would get an identical timestamp, making "most recent
-- row" ordering ambiguous. Production inserts happen in separate transactions and don't
-- have this issue; this is a test-fixture concern only.
insert into reminder_channel_consent (id, contact_id, business_id, requested_channel_id, source_channel_id, status, created_at)
select '9c000000-0000-0000-0000-000000000003', '9b000000-0000-0000-0000-000000000002', '9a000000-0000-0000-0000-000000000001',
  wa.id, ig.id, 'pending', timestamptz '2020-01-01T00:00:00Z'
from (select id from channels where name = 'whatsapp') wa, (select id from channels where name = 'instagram') ig;

-- UPDATE must be rejected, for every role -- run as postgres (superuser-like local role).
do $$
declare
  update_succeeded boolean := false;
begin
  begin
    update reminder_channel_consent set status = 'granted'
    where id = '9c000000-0000-0000-0000-000000000003';
    update_succeeded := true;
  exception when others then
    update_succeeded := false;
  end;
  if update_succeeded then
    raise exception 'ASSERTION FAILED: UPDATE on reminder_channel_consent should have been rejected by the append-only trigger';
  end if;
end $$;

-- DELETE must be rejected too.
do $$
declare
  delete_succeeded boolean := false;
begin
  begin
    delete from reminder_channel_consent where id = '9c000000-0000-0000-0000-000000000003';
    delete_succeeded := true;
  exception when others then
    delete_succeeded := false;
  end;
  if delete_succeeded then
    raise exception 'ASSERTION FAILED: DELETE on reminder_channel_consent should have been rejected by the append-only trigger';
  end if;
end $$;

select pg_temp.assert(
  (select status from reminder_channel_consent where id = '9c000000-0000-0000-0000-000000000003') = 'pending',
  'the original row must be untouched after the rejected UPDATE/DELETE attempts'
);

-- A status change is recorded by INSERTing a new row, not mutating the old one -- confirm
-- this legitimate path still works (the trigger must not be over-broad and block inserts).
insert into reminder_channel_consent (contact_id, business_id, requested_channel_id, source_channel_id, status, created_at)
select '9b000000-0000-0000-0000-000000000002', '9a000000-0000-0000-0000-000000000001', wa.id, ig.id, 'granted', now()
from (select id from channels where name = 'whatsapp') wa, (select id from channels where name = 'instagram') ig;

select pg_temp.assert(
  (select count(*) from reminder_channel_consent where contact_id = '9b000000-0000-0000-0000-000000000002') = 2,
  'appending a new consent-status row must succeed and coexist with the original row'
);

select pg_temp.assert(
  (select status from current_reminder_channel_consent where contact_id = '9b000000-0000-0000-0000-000000000002') = 'granted',
  'current_reminder_channel_consent must reflect the most recent row, not the original pending one'
);

do $$ begin raise notice 'Reminder consent append-only guard test: PASSED'; end $$;

rollback;
