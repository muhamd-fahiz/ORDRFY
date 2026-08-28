-- Build Phase 2: schedules the reminder engine to run every 5 minutes
-- (Ordrfy-Final-Implementation-Plan.pdf Phase 1 default polling interval), via pg_cron
-- calling pg_net to invoke app/api/cron/reminders/route.ts.
--
-- Deliberately does NOT hardcode a target URL or secret here: this migration file is
-- meant to be identical across local/staging/production (Ordrfy-Final-Architecture.pdf
-- Section 14), but the app's actual URL is different in each of those. Instead it reads
-- both the endpoint URL and the shared secret from Vault at execution time -- pg_cron jobs
-- run natively inside Postgres (as a role with direct schema access), so they can read
-- vault.decrypted_secrets directly, unlike PostgREST-mediated application code, which is
-- why 20260828120026's SECURITY DEFINER wrappers aren't needed here.
--
-- Per-environment setup required before this job can actually succeed: seed two Vault
-- secrets named 'cron_reminder_endpoint_url' and 'cron_internal_secret' (see
-- scripts/setup-cron-secrets.mjs for local dev). Until they exist, net.http_post below
-- receives a null url and the job run fails harmlessly -- visible in cron.job_run_details,
-- not a security gap.
select cron.schedule(
  'reminder-engine-tick',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cron_reminder_endpoint_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_internal_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
