-- India-fit addendum #11: WhatsApp opt-out phrases ("STOP", "unsubscribe", and their
-- regional-language equivalents -- ties directly to addendum #10's language support) must
-- be detected and honored, both to respect the customer and to protect the business's
-- WhatsApp messaging-quality rating and tier (round 3 recommendation #6) from spam
-- complaints. business_id nullable = global default phrase list, same pattern as
-- internal_reply_rules/message_templates/pipeline_stages.
create table opt_out_keywords (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade, -- null = global default
  language text not null default 'en',
  keyword text not null,
  active boolean not null default true,
  unique (business_id, language, keyword)
);

comment on table opt_out_keywords is
  'Checked against every inbound message BEFORE internal_reply_rules matching -- an opt-out '
  'phrase always takes priority over any other automation match, since continuing to '
  'process it as an ordinary inquiry would defeat the point. On a match: set '
  'contact_channel_identities.opted_out_at for that channel identity, log to activity_log, '
  'and do not treat the message as a normal inquiry.';

alter table opt_out_keywords enable row level security;

create policy "opt_out_keywords_readable"
  on opt_out_keywords for select
  using (
    business_id is null
    or business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

create index idx_opt_out_keywords_business_language on opt_out_keywords(business_id, language);
