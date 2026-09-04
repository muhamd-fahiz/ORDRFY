-- Self-service onboarding, Phase 1 (docs/architecture/decisions/0040-self-service-signup-
-- and-provisioning-core.md). The shared ProvisioningCore both the admin-assisted and
-- self-service paths converge on, matching the existing plpgsql-RPC-function precedent for
-- anything that must be one indivisible unit (claim_next_reminder(), the Vault credential
-- functions in 20260828120026) rather than the sequential-service-role-calls-with-manual-
-- rollback pattern app/api/admin/businesses/[id]/create-owner/route.ts uses today -- that
-- pattern is fine for the 2 tables it touches; a 5-table provisioning write is the wrong
-- tier for it. A partial-failure state here (business created, membership or entitlements
-- missing) is a real tenant-integrity bug, not a cosmetic one -- a single Postgres
-- transaction makes it structurally impossible rather than relying on hand-written
-- compensating deletes.
--
-- provision_business() is the generic core: given already-resolved inputs, it creates a
-- business plus the default settings/entitlements every business needs regardless of how
-- it was provisioned -- closing the pre-existing gap where neither createBusiness() nor
-- create-owner/route.ts wrote business_settings/business_entitlements at all. p_owner_user_id
-- is nullable because the admin-assisted path creates a business with NO owner yet (the
-- existing create-owner/route.ts flow adds the membership as a later, separate step,
-- unchanged by this migration) -- "membership where applicable", not always.
-- p_knowledge_profile is nullable for the same reason: only the self-service path (via
-- finish_onboarding() below) ever has one to write; an admin-created business simply has no
-- business_knowledge_profiles row until the owner completes the wizard later.
create or replace function provision_business(
  p_name text,
  p_vertical text,
  p_phone text default null,
  p_email text default null,
  p_timezone text default 'Asia/Kolkata',
  p_preferred_language text default 'en',
  p_subscription_status text default 'trial',
  p_owner_user_id uuid default null,
  p_actor_user_id uuid default null,
  p_source text default 'admin',
  p_knowledge_profile jsonb default null
)
returns businesses
language plpgsql
as $$
declare
  v_business businesses;
begin
  insert into businesses (name, vertical, phone, email, timezone, preferred_language, subscription_status, trial_ends_at)
  values (
    p_name,
    p_vertical,
    p_phone,
    p_email,
    p_timezone,
    p_preferred_language,
    p_subscription_status,
    case when p_subscription_status = 'trial' then now() + interval '14 days' else null end
  )
  returning * into v_business;

  if p_owner_user_id is not null then
    insert into business_memberships (user_id, business_id, role)
    values (p_owner_user_id, v_business.id, 'owner');
  end if;

  -- Vertical-defaulted operating settings, written identically regardless of provisioning
  -- path -- ADR-0013's trial-eligibility formula already reads trial_grace_period_days; no
  -- existing business actually has this key set today, since neither prior path wrote it.
  insert into business_settings (business_id, setting_key, setting_value)
  values (v_business.id, 'trial_grace_period_days', '3');

  -- No real pricing/plan gating exists yet (pricing_plans has no active, priced rows --
  -- CLAUDE.md known blocker #2) -- both channels active by default matches what every
  -- existing business effectively gets today in practice.
  insert into business_entitlements (business_id, entitlement_key, active)
  values
    (v_business.id, 'channel:whatsapp', true),
    (v_business.id, 'channel:instagram', true);

  if p_knowledge_profile is not null then
    insert into business_knowledge_profiles (business_id, vertical, summary, structured_answers, source)
    values (
      v_business.id,
      p_vertical,
      p_knowledge_profile->>'summary',
      coalesce(p_knowledge_profile->'structured_answers', '{}'::jsonb),
      p_source
    );
  end if;

  insert into activity_log (business_id, event_type, event_detail, actor_user_id)
  values (
    v_business.id,
    case when p_source = 'self_service' then 'business_self_provisioned' else 'business_admin_provisioned' end,
    jsonb_build_object('source', p_source),
    coalesce(p_actor_user_id, p_owner_user_id)
  );

  return v_business;
end;
$$;

-- finish_onboarding() is the self-service-specific wrapper: idempotent completion of a
-- signup_drafts row into a real business via provision_business(). Idempotency mirrors how
-- reminders.idempotency_key/messages.outbound_idempotency_key already treat "already done"
-- as a success path elsewhere in this codebase, not a new idea -- a draft already
-- 'completed' returns its existing provisioned business rather than erroring or
-- double-inserting. `for update` locks the draft row for the duration of the transaction,
-- closing the double-click/two-device race: a second concurrent call simply blocks until
-- the first commits, then sees status = 'completed' and takes the idempotent return path.
create or replace function finish_onboarding(p_draft_id uuid)
returns businesses
language plpgsql
as $$
declare
  v_draft signup_drafts;
  v_business businesses;
begin
  select * into v_draft from signup_drafts where id = p_draft_id for update;

  if not found then
    raise exception 'signup_drafts % does not exist', p_draft_id;
  end if;

  if v_draft.status = 'completed' then
    select * into v_business from businesses where id = v_draft.provisioned_business_id;
    return v_business;
  end if;

  if v_draft.detected_vertical is null or v_draft.business_name is null then
    raise exception 'signup_drafts % is missing required fields for provisioning', p_draft_id;
  end if;

  v_business := provision_business(
    p_name := v_draft.business_name,
    p_vertical := v_draft.detected_vertical,
    p_timezone := 'Asia/Kolkata',
    p_preferred_language := 'en',
    p_subscription_status := 'trial',
    p_owner_user_id := v_draft.user_id,
    p_actor_user_id := v_draft.user_id,
    p_source := 'self_service',
    p_knowledge_profile := jsonb_build_object(
      'summary', v_draft.raw_business_description,
      -- city has no dedicated businesses column (every business today is India/IST-only --
      -- see Settings' own TIMEZONE_OPTIONS reasoning) -- folded into the knowledge profile's
      -- own structured data instead of adding a column with only one real market value.
      'structured_answers', v_draft.structured_answers || jsonb_build_object('city', v_draft.city)
    )
  );

  update signup_drafts
  set status = 'completed', completed_at = now(), provisioned_business_id = v_business.id, updated_at = now()
  where id = p_draft_id;

  return v_business;
end;
$$;

-- Both functions are provisioning-path entry points, callable only from trusted server
-- code (the shared lib/provisioning/provision-business.ts wrapper, via the service-role
-- client) -- never directly by an authenticated end user, the same boundary already proven
-- for claim_next_reminder()/the Vault functions. Ownership/authorization (e.g. "is this
-- draft actually the calling user's own") is checked by the calling Next.js route before
-- invoking finish_onboarding(), matching how create-owner/route.ts checks the admin session
-- before its own service-role writes -- not re-encoded inside the SQL function itself.
revoke execute on function provision_business(text, text, text, text, text, text, text, uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function finish_onboarding(uuid) from public, anon, authenticated;

grant execute on function provision_business(text, text, text, text, text, text, text, uuid, uuid, text, jsonb) to service_role;
grant execute on function finish_onboarding(uuid) to service_role;
