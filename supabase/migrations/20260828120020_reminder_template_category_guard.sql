-- Round 2 recommendation #1: WhatsApp reminder templates must always be filed as Utility
-- category -- cheaper, stricter opt-in rules, less likely to be flagged than Marketing.
-- Enforced at the database level (not just application code / admin panel UI) so a bug or a
-- direct data edit cannot silently attach a Marketing-or-Authentication-category template
-- to the reminder engine.
--
-- Deliberately scoped to the WhatsApp channel only: Instagram rows in message_templates are
-- not real Meta-approved templates at all (see message_templates comment) and category is
-- nullable for them -- this guard does not apply there.
create or replace function guard_reminder_template_category()
returns trigger as $$
declare
  template_category text;
  whatsapp_channel_id uuid;
begin
  if new.message_template_id is null then
    return new;
  end if;

  select id into whatsapp_channel_id from channels where name = 'whatsapp';

  if new.channel_id != whatsapp_channel_id then
    return new;
  end if;

  select category into template_category
  from message_templates
  where id = new.message_template_id;

  if template_category is distinct from 'utility' then
    raise exception
      'reminders.message_template_id % must reference a message_templates row with '
      'category = utility for WhatsApp reminders (got: %). Marketing/Authentication '
      'templates carry different cost and compliance rules and must never be used for '
      'automated reminders.', new.message_template_id, coalesce(template_category, 'null');
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_guard_reminder_template_category
  before insert or update of message_template_id, channel_id on reminders
  for each row execute function guard_reminder_template_category();
