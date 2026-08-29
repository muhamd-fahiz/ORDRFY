-- Vertical Expansion (docs/architecture/decisions/0009-verticals-reference-table.md): the
-- original schema hardcoded `vertical text check (vertical in ('fashion','tutor','service'))`
-- independently on FIVE tables (businesses, pipeline_stages, internal_reply_rules,
-- message_templates, and now vertical_field_definitions). Going from 3 to 5 verticals meant
-- editing all five CHECK lists by hand; the addendum's own stated goal is "adding a 6th
-- vertical later means inserting rows, not writing a migration." Replacing the CHECK
-- constraints with a foreign key to this table achieves exactly that, with minimal ripple:
-- `vertical` stays a plain text column everywhere it already was (the pipeline-stage guard
-- trigger's text comparison, every seed.sql literal, every application query) -- only the
-- validation mechanism changes, from a hardcoded list to a real table.
--
-- Uses a text primary key (the vertical's own key, e.g. 'fashion') rather than a synthetic
-- uuid, unlike `channels` -- deliberately, so every existing `vertical text` column can
-- reference it with zero changes to comparison/join logic anywhere else in the schema.
create table verticals (
  key text primary key,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table verticals is
  'active = false means the vertical exists conceptually but is not yet ready for a business '
  'to be assigned to it -- specifically: no populated pipeline_stages/internal_reply_rules/'
  'message_templates rows yet. Baker and Gift are inserted here as part of the 3->5 vertical '
  'expansion, but seeded active=false until their real config content (from the Bakers & '
  'Gift Businesses source addendum) is available and Build Phase 3 work populates it.';

-- Reference table, no tenant data -- readable by any authenticated user, same as channels.
alter table verticals enable row level security;

create policy "verticals_readable_by_authenticated"
  on verticals for select
  using (auth.role() = 'authenticated');
