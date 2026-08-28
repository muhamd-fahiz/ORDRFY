-- Confirms Non-Negotiable Architecture Rule 3: multi-tenancy via RLS, business_id resolved
-- live via business_memberships + auth.uid(), never a static claim. Everything here runs
-- inside one transaction that is rolled back at the end, so no fixture data persists.
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

insert into businesses (id, name, phone, email, vertical, subscription_status, timezone, preferred_language)
values
  ('a1000000-0000-0000-0000-000000000001', 'RLS Test Biz A', '+910000000001', 'rls-a@example.com', 'fashion', 'active', 'Asia/Kolkata', 'en'),
  ('b2000000-0000-0000-0000-000000000002', 'RLS Test Biz B', '+910000000002', 'rls-b@example.com', 'fashion', 'active', 'Asia/Kolkata', 'en');

insert into business_memberships (user_id, business_id, role)
values
  ('11111111-1111-1111-1111-111111111111', 'a1000000-0000-0000-0000-000000000001', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'b2000000-0000-0000-0000-000000000002', 'owner');

insert into contacts (id, business_id, name)
values
  ('c1a00000-0000-0000-0000-00000000000a', 'a1000000-0000-0000-0000-000000000001', 'Contact A'),
  ('c1b00000-0000-0000-0000-00000000000b', 'b2000000-0000-0000-0000-000000000002', 'Contact B');

-- Impersonate user A: a member of business A only.
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select pg_temp.assert(
  (select count(*) from contacts) = 1,
  'user A should see exactly 1 contact total under RLS'
);

select pg_temp.assert(
  (select count(*) from contacts where id = 'c1a00000-0000-0000-0000-00000000000a') = 1,
  'user A should see their own business''s contact'
);

select pg_temp.assert(
  (select count(*) from contacts where id = 'c1b00000-0000-0000-0000-00000000000b') = 0,
  'user A must NOT see business B''s contact via RLS'
);

-- Cross-tenant UPDATE: the USING clause filters it out of the update target set entirely
-- (0 rows affected), it does not error.
update contacts set name = 'hacked' where id = 'c1b00000-0000-0000-0000-00000000000b';

reset role;
select pg_temp.assert(
  (select name from contacts where id = 'c1b00000-0000-0000-0000-00000000000b') = 'Contact B',
  'cross-tenant UPDATE attempt must not have modified business B''s contact'
);

-- Cross-tenant INSERT: policy is FOR ALL with no explicit WITH CHECK, so Postgres reuses
-- the USING expression as WITH CHECK too -- an insert targeting business B must be rejected.
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

do $$
declare
  insert_succeeded boolean := false;
begin
  begin
    insert into contacts (id, business_id, name)
    values ('c1c00000-0000-0000-0000-00000000000c', 'b2000000-0000-0000-0000-000000000002', 'Sneaky Insert');
    insert_succeeded := true;
  exception when others then
    insert_succeeded := false;
  end;
  if insert_succeeded then
    raise exception 'ASSERTION FAILED: cross-tenant INSERT into business B should have been rejected by RLS';
  end if;
end $$;

reset role;
select pg_temp.assert(
  (select count(*) from contacts where id = 'c1c00000-0000-0000-0000-00000000000c') = 0,
  'cross-tenant insert must not have persisted any row'
);

do $$ begin raise notice 'RLS isolation test: PASSED'; end $$;

rollback;
