-- Self-service onboarding, Phase 1 (docs/architecture/decisions/0040-self-service-signup-
-- and-provisioning-core.md). The structured result of the guided wizard's business-
-- understanding steps, written once by provision_business() at the moment a self-service
-- business is created. Deliberately NOT named business_profile: lib/data/business-profile.ts
-- already exports an unrelated BusinessProfile type (the Settings page's owner-editable
-- name/phone/email/timezone/language subset) -- reusing that name here would give two
-- unrelated concepts the same name in the same codebase.
--
-- An admin-created business has no row here at all until the owner completes the wizard
-- later (the "Complete your business profile" nudge, Phase 2/4) -- absence is the signal
-- that onboarding knowledge is missing, the same way order_field_values rows are simply
-- absent until a field is actually filled in. No new lifecycle/status column on businesses
-- was introduced for this -- a nullable one-to-one relationship is sufficient.
create table business_knowledge_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references businesses(id) on delete cascade,
  vertical text not null references verticals(key),
  summary text not null,
  structured_answers jsonb not null default '{}'::jsonb,
  knowledge_version integer not null default 1,
  source text not null default 'self_service_onboarding',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table business_knowledge_profiles is
  'One row per business. Real columns for what a review screen or future admin lookup '
  'actually queries (vertical, summary); jsonb for what genuinely varies per vertical and '
  'grows over time (structured_answers: the wizard''s attribute/operating-preference chip '
  'selections) -- the same structured-columns-plus-jsonb balance vertical_field_definitions/'
  'order_field_values already struck for a different table pair (ADR-0010). knowledge_version '
  'stays at 1 in this phase -- no editing UI exists yet, so there is nothing to version '
  'against; added now only so a future edit feature does not need a migration to start '
  'tracking revisions. source distinguishes provenance (only ''self_service_onboarding'' is '
  'ever written by this phase) without inventing a broader provenance/lifecycle model.';

alter table business_knowledge_profiles enable row level security;

create policy "tenant_isolation_business_knowledge_profiles"
  on business_knowledge_profiles for all
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

create index idx_business_knowledge_profiles_business_id on business_knowledge_profiles(business_id);
