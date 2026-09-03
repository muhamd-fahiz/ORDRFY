-- Audit finding #3: confirms idx_owner_attention_queue_reference_unique actually prevents a
-- second row for the same (reference_type, reference_id) at the database level -- the real
-- guarantee application code (lib/engine/automation.ts's insertAttentionItem) now relies on,
-- replacing a prior SELECT-then-INSERT that had a TOCTOU race under concurrency. Also
-- confirms the partial index's WHERE clause correctly exempts manual_flag-style rows
-- (reference_id IS NULL) from uniqueness -- an owner flagging the same contact more than
-- once must remain possible.
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
values ('a1000000-0000-0000-0000-000000000001', 'Attention Uniqueness Test Biz', 'fashion', 'active');

insert into contacts (id, business_id, name)
values ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Contact A');

insert into messages (id, contact_id, business_id, channel_id, direction, provider)
values (
  'd1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001', (select id from channels where name = 'whatsapp'), 'inbound', 'mock'
);

insert into owner_attention_queue (business_id, contact_id, reason, reference_type, reference_id)
values ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'unmatched_message', 'message', 'd1000000-0000-0000-0000-000000000001');

-- A second row for the exact same (reference_type, reference_id) must be rejected outright --
-- not just discouraged by application logic.
do $$
declare
  insert_succeeded boolean := false;
begin
  begin
    insert into owner_attention_queue (business_id, contact_id, reason, reference_type, reference_id)
    values ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'ai_low_confidence', 'message', 'd1000000-0000-0000-0000-000000000001');
    insert_succeeded := true;
  exception when others then
    insert_succeeded := false;
  end;
  if insert_succeeded then
    raise exception 'ASSERTION FAILED: a second owner_attention_queue row for the same (reference_type, reference_id) should have been rejected';
  end if;
end $$;

select pg_temp.assert(
  (select count(*) from owner_attention_queue where reference_id = 'd1000000-0000-0000-0000-000000000001') = 1,
  'exactly one attention item should exist for this message reference'
);

-- manual_flag-style rows (reference_id NULL) are exempt from the uniqueness constraint --
-- multiple such rows for the same contact must remain allowed.
insert into owner_attention_queue (business_id, contact_id, reason, reference_type, reference_id)
values
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'manual_flag', 'contact', null),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'manual_flag', 'contact', null);

select pg_temp.assert(
  (select count(*) from owner_attention_queue where reason = 'manual_flag' and reference_id is null) = 2,
  'multiple manual_flag entries with a null reference_id should both be allowed'
);

do $$ begin raise notice 'owner_attention_queue reference uniqueness test: PASSED'; end $$;

rollback;
