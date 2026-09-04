-- Self-service onboarding, Phase 1 (docs/architecture/decisions/0040-self-service-signup-
-- and-provisioning-core.md). Draft cleanup is a plain DELETE with no application logic
-- involved -- unlike the reminder engine's pg_cron tick (20260828120028), which must reach
-- app/api/cron/reminders/route.ts via pg_net to run real send logic, this needs no HTTP
-- hop through Vault-stored secrets. A daily schedule is more than sufficient for a 14-day
-- expiry window; reuses the pg_cron extension already enabled for the reminder engine,
-- not a new job type.
create or replace function expire_stale_signup_drafts()
returns integer
language plpgsql
as $$
declare
  v_deleted_count integer;
begin
  with deleted as (
    delete from signup_drafts
    where status = 'in_progress' and expires_at < now()
    returning id
  )
  select count(*) into v_deleted_count from deleted;

  return v_deleted_count;
end;
$$;

revoke execute on function expire_stale_signup_drafts() from public, anon, authenticated;
grant execute on function expire_stale_signup_drafts() to service_role, postgres;

select cron.schedule(
  'expire-stale-signup-drafts',
  '0 3 * * *',
  $$ select expire_stale_signup_drafts(); $$
);
