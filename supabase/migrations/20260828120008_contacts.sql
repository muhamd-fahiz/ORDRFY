create table contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text,
  pipeline_stage_id uuid references pipeline_stages(id),
  is_high_priority boolean not null default false,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table contacts is
  'The person, from the business''s point of view. Deliberately has no phone/handle field -- '
  'identity lives in contact_channel_identities. Never resolve an inbound message to a '
  'contact via a phone-number lookup on this table (Ordrfy-Multi-Channel-Addendum.pdf, '
  'Non-Negotiable Architecture Rule 2).';

alter table contacts enable row level security;

create policy "tenant_isolation_contacts"
  on contacts for all
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

create index idx_contacts_business_id on contacts(business_id);
