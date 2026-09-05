-- Pre-Phase 7 correctness remediation, Finding 1 (independently confirmed, empirically
-- verified before this migration was written -- see the read-only audit that preceded it).
--
-- Every tenant table used the same "for all using (business_id in (select business_id from
-- business_memberships where user_id = auth.uid()))" policy with no `with check`. Per
-- Postgres's own documented behavior (confirmed empirically, not assumed: a rolled-back
-- transaction impersonating a real owner successfully flipped businesses.automation_paused,
-- set subscription_status='active', inserted business_settings(automation_mode='smart'), and
-- deleted their own activity_log rows), a `for all` policy with only `using` reuses that same
-- expression as the write-check too -- so tenant scoping was the ONLY restriction on writes
-- to these six tables. Nothing prevented an authenticated owner from writing any column to
-- any value on their own row, including fields the architecture (CLAUDE.md Non-Negotiable
-- Rule 7, ADR-0011) explicitly reserves for admin/service-role control.
--
-- This is scoped to exactly the six control-plane/audit tables identified: businesses,
-- business_settings, business_entitlements, business_channel_connections, activity_log,
-- automation_decision_log. contacts/messages/payments/reminders/pipeline_stages (the
-- tenant's own operational data) are deliberately untouched -- broadening this to them is
-- general hardening, not this narrow remediation.
--
-- Every replacement policy below was derived from an exhaustive grep of every actual writer
-- in the codebase (app/ and lib/), not guessed: each operation kept is one a real, currently
-- shipped code path depends on; every operation removed has zero current writer.

-- ---------------------------------------------------------------------------
-- businesses: owners may SELECT and UPDATE their own row. No INSERT (only the
-- provision_business()/finish_onboarding() RPCs create businesses, both service-role). No
-- DELETE (ADR-0011: soft-delete via deleted_at only, never a tenant self-service action).
-- UPDATE itself is further restricted below, by trigger, to the 5 profile columns
-- app/api/app/settings/route.ts actually writes -- RLS's `with check` can't express
-- "these specific columns must stay unchanged" without an awkward self-join, so a
-- before-update trigger is used instead, matching this schema's own established pattern
-- (guard_contact_business_match, guard_pipeline_stage, guard_automation_decision_log_business_match).
-- ---------------------------------------------------------------------------
drop policy "tenant_isolation_businesses" on businesses;

create policy "tenant_select_businesses"
  on businesses for select
  using (
    id in (select business_id from business_memberships where user_id = auth.uid())
  );

create policy "tenant_update_businesses"
  on businesses for update
  using (
    id in (select business_id from business_memberships where user_id = auth.uid())
  )
  with check (
    id in (select business_id from business_memberships where user_id = auth.uid())
  );

create or replace function guard_business_owner_writable_fields()
returns trigger as $$
begin
  -- service_role (admin routes, the provisioning RPCs, webhook/cron code) is exempt --
  -- this trigger exists only to constrain the tenant-facing 'authenticated' role. Triggers
  -- are NOT skipped by a role's BYPASSRLS the way policies are, so this check is required
  -- even though service_role already bypasses the policies above.
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.vertical is distinct from old.vertical
    or new.subscription_status is distinct from old.subscription_status
    or new.trial_ends_at is distinct from old.trial_ends_at
    or new.automation_paused is distinct from old.automation_paused
    or new.deleted_at is distinct from old.deleted_at
  then
    raise exception 'businesses: only name/phone/email/timezone/preferred_language may be changed by a tenant owner';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_guard_business_owner_writable_fields
  before update on businesses
  for each row execute function guard_business_owner_writable_fields();

-- ---------------------------------------------------------------------------
-- business_settings / business_entitlements / business_channel_connections: read-only for
-- tenants today. Confirmed by exhaustive grep -- zero app-level writers via the RLS client
-- for any of the three; every existing writer (provisioning RPCs, the admin
-- subscription-amount route) already uses the service-role client, which bypasses RLS
-- entirely and is unaffected by this change.
-- ---------------------------------------------------------------------------
drop policy "tenant_isolation_business_settings" on business_settings;
create policy "tenant_select_business_settings"
  on business_settings for select
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

drop policy "tenant_isolation_business_entitlements" on business_entitlements;
create policy "tenant_select_business_entitlements"
  on business_entitlements for select
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

drop policy "tenant_isolation_business_channel_connections" on business_channel_connections;
create policy "tenant_select_business_channel_connections"
  on business_channel_connections for select
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- activity_log / automation_decision_log: append-only audit trails. Owners may SELECT and
-- INSERT (many real call sites depend on INSERT -- the automation engine itself writes
-- through the RLS client when invoked from an owner-authenticated route, e.g. the First
-- Value "Try Ordrfy" demo), but never UPDATE or DELETE -- confirmed zero writer anywhere
-- ever performs either. activity_log's insert check additionally requires actor_user_id (if
-- set at all) to be the caller's own uid -- a cheap, specific close of one forgeable field,
-- not a broader redesign. automation_decision_log needs no equivalent check: it already has
-- a tenant-consistency trigger (guard_automation_decision_log_business_match, ADR-0037) and
-- a unique constraint on message_id that together already prevent attaching a fabricated
-- decision to another business's message or to an already-decided one.
-- ---------------------------------------------------------------------------
drop policy "tenant_isolation_activity_log" on activity_log;

create policy "tenant_select_activity_log"
  on activity_log for select
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

create policy "tenant_insert_activity_log"
  on activity_log for insert
  with check (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
    and (actor_user_id is null or actor_user_id = auth.uid())
  );

drop policy "tenant_isolation_automation_decision_log" on automation_decision_log;

create policy "tenant_select_automation_decision_log"
  on automation_decision_log for select
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

create policy "tenant_insert_automation_decision_log"
  on automation_decision_log for insert
  with check (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );
