-- Confirms trg_guard_reminder_template_category (20260828120020) rejects attaching a
-- non-utility WhatsApp template to a reminder, and confirms the guard is correctly scoped to
-- the WhatsApp channel only (round 2 recommendation #1).
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
values ('7a000000-0000-0000-0000-000000000001', 'Template Guard Test Biz', 'fashion', 'active');

insert into contacts (id, business_id, name)
values ('7b000000-0000-0000-0000-000000000002', '7a000000-0000-0000-0000-000000000001', 'Template Guard Contact');

insert into message_templates (id, business_id, vertical, channel_id, template_key, category, reply_text)
select '7c000000-0000-0000-0000-000000000003', null, 'fashion', c.id, 'guard_test_utility', 'utility', 'utility reminder text'
from channels c where c.name = 'whatsapp';

insert into message_templates (id, business_id, vertical, channel_id, template_key, category, reply_text)
select '7d000000-0000-0000-0000-000000000004', null, 'fashion', c.id, 'guard_test_marketing', 'marketing', 'marketing reminder text'
from channels c where c.name = 'whatsapp';

insert into message_templates (id, business_id, vertical, channel_id, template_key, category, reply_text)
select '7e000000-0000-0000-0000-000000000005', null, 'fashion', c.id, 'guard_test_ig', null, 'instagram reminder text'
from channels c where c.name = 'instagram';

-- Valid: utility-category WhatsApp template attached to a WhatsApp reminder -- must succeed.
insert into reminders (id, business_id, contact_id, channel_id, reminder_type, scheduled_time_utc, message_template_id, status, idempotency_key)
select '7f000000-0000-0000-0000-000000000006', '7a000000-0000-0000-0000-000000000001', '7b000000-0000-0000-0000-000000000002',
  c.id, 'payment_due', now(), '7c000000-0000-0000-0000-000000000003', 'pending', 'guard-test-key-1'
from channels c where c.name = 'whatsapp';

select pg_temp.assert(
  (select count(*) from reminders where id = '7f000000-0000-0000-0000-000000000006') = 1,
  'a utility-category WhatsApp template on a reminder should have been allowed'
);

-- Invalid: marketing-category WhatsApp template on a WhatsApp reminder -- must raise.
do $$
declare
  insert_succeeded boolean := false;
begin
  begin
    insert into reminders (id, business_id, contact_id, channel_id, reminder_type, scheduled_time_utc, message_template_id, status, idempotency_key)
    select '80000000-0000-0000-0000-000000000007', '7a000000-0000-0000-0000-000000000001', '7b000000-0000-0000-0000-000000000002',
      c.id, 'payment_due', now(), '7d000000-0000-0000-0000-000000000004', 'pending', 'guard-test-key-2'
    from channels c where c.name = 'whatsapp';
    insert_succeeded := true;
  exception when others then
    insert_succeeded := false;
  end;
  if insert_succeeded then
    raise exception 'ASSERTION FAILED: a marketing-category WhatsApp template should have been rejected for a reminder';
  end if;
end $$;

select pg_temp.assert(
  (select count(*) from reminders where id = '80000000-0000-0000-0000-000000000007') = 0,
  'the rejected marketing-template reminder must not have persisted'
);

-- Scoping check: the guard only inspects channel_id = whatsapp -- an Instagram reminder
-- attaching a template row is never subject to the utility-category requirement (Instagram
-- rows in message_templates are not real Meta-approved templates and category is nullable).
insert into reminders (id, business_id, contact_id, channel_id, reminder_type, scheduled_time_utc, message_template_id, status, idempotency_key)
select '81000000-0000-0000-0000-000000000008', '7a000000-0000-0000-0000-000000000001', '7b000000-0000-0000-0000-000000000002',
  c.id, 'payment_due', now(), '7e000000-0000-0000-0000-000000000005', 'pending', 'guard-test-key-3'
from channels c where c.name = 'instagram';

select pg_temp.assert(
  (select count(*) from reminders where id = '81000000-0000-0000-0000-000000000008') = 1,
  'an Instagram reminder must not be subject to the WhatsApp-only utility-category guard'
);

do $$ begin raise notice 'Reminder template category guard test: PASSED'; end $$;

rollback;
