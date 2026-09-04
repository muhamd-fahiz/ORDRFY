-- Self-service onboarding, Phase 1 (docs/architecture/decisions/0040-self-service-signup-
-- and-provisioning-core.md). Transient pre-tenant state for an authenticated user's
-- onboarding progress -- no businesses/business_memberships row exists yet, so an
-- abandoned signup never leaves a ghost tenant behind. Isolation is by user_id directly
-- (auth.uid()), the same shape as business_memberships' own "members_see_own_memberships"
-- policy -- there is no business_id to scope by here, since none exists yet.
--
-- One active draft per user in V1: resuming means "the" draft, not choosing among several.
-- Enforced as a partial unique index rather than a table-level constraint, since a user CAN
-- have more than one row total over time (a completed draft, then later a fresh one is not
-- a case this phase needs to support, but the index only restricts concurrent
-- 'in_progress' rows, not historical ones).
create table signup_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  current_step text,
  business_name text,
  city text,
  raw_business_description text,
  detected_vertical text references verticals(key),
  vertical_confidence text check (vertical_confidence in ('confident', 'ambiguous', 'unmatched')),
  structured_answers jsonb not null default '{}'::jsonb,
  provisioned_business_id uuid references businesses(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  completed_at timestamptz
);

comment on table signup_drafts is
  'Pre-tenant onboarding state (ADR-0040). detected_vertical/vertical_confidence are written '
  'by the deterministic knowledge engine (Phase 3), not by this migration. '
  'provisioned_business_id is set exactly once, by finish_onboarding() itself at completion, '
  'and doubles as the idempotency anchor for a retried finish request -- see '
  '20260904000003_provisioning_core_functions.sql. expires_at drives cleanup (see '
  '20260904000004_expire_stale_signup_drafts.sql); no soft-delete needed since a draft holds '
  'no committed customer data, unlike ADR-0011''s reasoning for businesses.deleted_at.';

create unique index idx_signup_drafts_one_active_per_user
  on signup_drafts(user_id) where status = 'in_progress';

create index idx_signup_drafts_expires_at on signup_drafts(expires_at) where status = 'in_progress';

alter table signup_drafts enable row level security;

create policy "users_manage_own_draft"
  on signup_drafts for all
  using (user_id = auth.uid());
