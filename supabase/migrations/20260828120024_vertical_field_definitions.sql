-- Vertical Expansion addendum (docs/decisions/2026-08-28-vertical-expansion.md): Baker and
-- Gift Business introduce many order-specific fields (cake flavour, eggless/egg, custom
-- design notes, occasion, recipient relationship, personalization text, surprise-delivery
-- flag, budget range, delivery address, ...) that don't fit the original contacts/payments
-- schema, which Fashion and Tutor never needed to stretch this way. Bolting these on as new
-- nullable columns on contacts/payments would scatter per-vertical special-casing into the
-- shared tables -- the same anti-pattern the "no vertical conditionals in shared-engine
-- code" rule exists to prevent, just at the schema level instead of the code level.
--
-- This mechanism gives every vertical -- the original 3, the 2 new ones, and any future
-- one -- the same generic way to define and store "what does this business need to track
-- per order/inquiry," entirely as configuration data. Adding a 6th vertical's custom fields
-- later means inserting rows into vertical_field_definitions, not a migration.
--
-- A structured table over a single jsonb column on contacts was a deliberate choice, not
-- the simpler default: jsonb can't enforce required fields, validate select-list options at
-- the database level, or support an indexed query like "all orders with
-- surprise_required = true due this week" -- which the Gift dashboard explicitly needs.
create table vertical_field_definitions (
  id uuid primary key default gen_random_uuid(),
  vertical text not null references verticals(key),
  field_key text not null,
  field_label text not null,
  field_type text not null check (field_type in ('text', 'number', 'boolean', 'date', 'select')),
  select_options text[], -- populated only when field_type = 'select'
  is_required boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  unique (vertical, field_key)
);

comment on table vertical_field_definitions is
  'One row per configurable field per vertical, e.g. (baker, cake_flavour, "Cake Flavour", '
  'select, [Chocolate, Vanilla, ...]) or (gift, recipient_relationship, "Recipient '
  'Relationship", select, [...]). No business_id column -- these are vertical-wide '
  'definitions, not per-business customizable in V1 (consistent with pipeline_stages/'
  'internal_reply_rules/message_templates only supporting business-level overrides where '
  'the addendum that introduced them explicitly asked for that; this one didn''t).';

-- Reference table, no tenant data -- readable by any authenticated user, same as channels/verticals.
alter table vertical_field_definitions enable row level security;

create policy "vertical_field_definitions_readable"
  on vertical_field_definitions for select
  using (auth.role() = 'authenticated');

create index idx_vertical_field_definitions_vertical on vertical_field_definitions(vertical);

create table order_field_values (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  field_definition_id uuid not null references vertical_field_definitions(id),
  value_text text,
  value_number numeric,
  value_boolean boolean,
  value_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, field_definition_id)
);

comment on table order_field_values is
  'Exactly one of value_text/value_number/value_boolean/value_date is populated per row, '
  'matching the referenced field_definition.field_type -- enforced at the application layer '
  '(Build Phase 3, when Baker/Gift vertical configuration is built), not a DB CHECK, since '
  'expressing "which column is non-null depends on a joined row''s field_type" as a portable '
  'CHECK constraint adds real complexity for a mistake application code should simply not make.';

alter table order_field_values enable row level security;

create policy "tenant_isolation_order_field_values"
  on order_field_values for all
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

create index idx_order_field_values_contact_id on order_field_values(contact_id);
create index idx_order_field_values_business_id on order_field_values(business_id);
