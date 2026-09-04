-- Confirms the shared ProvisioningCore (20260904000003_provisioning_core_functions.sql,
-- ADR-0040): provision_business() is reachable only by service_role, the admin path (no
-- owner/no knowledge profile) and self-service path (owner + knowledge profile, via
-- finish_onboarding()) both write the full expected record set, and finish_onboarding() is
-- idempotent against a retried call for the same draft.
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
  ('91111111-1111-1111-1111-111111111111');

-- === permission boundary ===========================================================

set local role anon;
do $$
declare
  call_succeeded boolean := false;
begin
  begin
    perform provision_business('Anon Test Biz', 'fashion');
    call_succeeded := true;
  exception when others then
    call_succeeded := false;
  end;
  if call_succeeded then
    raise exception 'ASSERTION FAILED: anon must not be able to call provision_business';
  end if;
end $$;
reset role;

set local role authenticated;
do $$
declare
  call_succeeded boolean := false;
begin
  begin
    perform provision_business('Authenticated Test Biz', 'fashion');
    call_succeeded := true;
  exception when others then
    call_succeeded := false;
  end;
  if call_succeeded then
    raise exception 'ASSERTION FAILED: authenticated must not be able to call provision_business';
  end if;
end $$;
reset role;

-- === admin path: no owner, no knowledge profile ====================================

set local role service_role;

do $$
declare
  v_business businesses;
begin
  v_business := provision_business(
    p_name := 'Admin-Provisioned Biz',
    p_vertical := 'fashion',
    p_actor_user_id := '91111111-1111-1111-1111-111111111111',
    p_source := 'admin'
  );

  perform pg_temp.assert(v_business.subscription_status = 'trial', 'admin path should default to trial status');
  perform pg_temp.assert(v_business.trial_ends_at is not null, 'admin path should set trial_ends_at');

  perform pg_temp.assert(
    (select count(*) from business_memberships where business_id = v_business.id) = 0,
    'admin path should create zero memberships -- owner is added later, separately'
  );
  perform pg_temp.assert(
    (select count(*) from business_knowledge_profiles where business_id = v_business.id) = 0,
    'admin path should create zero knowledge profile rows'
  );
  perform pg_temp.assert(
    (select setting_value from business_settings where business_id = v_business.id and setting_key = 'trial_grace_period_days') = '3',
    'admin path should write the default trial_grace_period_days setting'
  );
  perform pg_temp.assert(
    (select count(*) from business_entitlements where business_id = v_business.id and active) = 2,
    'admin path should write both channel entitlements, active'
  );
  perform pg_temp.assert(
    (select event_type from activity_log where business_id = v_business.id) = 'business_admin_provisioned',
    'admin path should log business_admin_provisioned'
  );
end $$;

-- === self-service path: owner + knowledge profile, via finish_onboarding() =========

do $$
declare
  v_draft_id uuid;
  v_business businesses;
  v_business_again businesses;
begin
  insert into signup_drafts (user_id, status, business_name, raw_business_description, detected_vertical, structured_answers, city)
  values (
    '91111111-1111-1111-1111-111111111111',
    'in_progress',
    'Self-Service Fashion Co',
    'I sell kurtis and dresses through Instagram',
    'fashion',
    '{"sizes_matter": true}'::jsonb,
    'Kochi'
  )
  returning id into v_draft_id;

  v_business := finish_onboarding(v_draft_id);

  perform pg_temp.assert(
    (select count(*) from business_memberships where business_id = v_business.id and user_id = '91111111-1111-1111-1111-111111111111' and role = 'owner') = 1,
    'self-service path should create exactly one owner membership'
  );
  perform pg_temp.assert(
    (select count(*) from business_knowledge_profiles where business_id = v_business.id) = 1,
    'self-service path should create exactly one knowledge profile'
  );
  perform pg_temp.assert(
    (select structured_answers->>'city' from business_knowledge_profiles where business_id = v_business.id) = 'Kochi',
    'the knowledge profile should fold the draft''s city into structured_answers'
  );
  perform pg_temp.assert(
    (select event_type from activity_log where business_id = v_business.id) = 'business_self_provisioned',
    'self-service path should log business_self_provisioned'
  );
  perform pg_temp.assert(
    (select status from signup_drafts where id = v_draft_id) = 'completed',
    'the draft should be marked completed'
  );
  perform pg_temp.assert(
    (select provisioned_business_id from signup_drafts where id = v_draft_id) = v_business.id,
    'the draft should record its provisioned business id'
  );

  -- Idempotency: a retried finish must not create a second business/membership, and must
  -- return the SAME business already provisioned.
  v_business_again := finish_onboarding(v_draft_id);

  perform pg_temp.assert(
    v_business_again.id = v_business.id,
    'a retried finish_onboarding() call must return the same business, not create a new one'
  );
  perform pg_temp.assert(
    (select count(*) from business_memberships where business_id = v_business.id) = 1,
    'a retried finish_onboarding() call must not create a second membership'
  );
end $$;

reset role;

do $$ begin raise notice 'Provisioning core test: PASSED'; end $$;

rollback;
