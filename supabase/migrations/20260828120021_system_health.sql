-- Round 2 recommendation #3: heartbeat monitoring so a silently-stopped reminder engine
-- (e.g. pg_cron job stops firing) is detectable, even though no individual reminder shows
-- as failed in that scenario -- nothing shows as anything, which could go unnoticed for
-- days. A single row per monitored job is sufficient at V1 scale; no dedicated job-queue or
-- monitoring service needed (consistent with the existing "no dedicated job queue in V1"
-- decision).
create table system_health (
  job_key text primary key, -- e.g. 'reminder_engine'
  last_run_at timestamptz not null,
  updated_at timestamptz not null default now()
);

comment on table system_health is
  'The reminder-claiming pg_cron job upserts its row here on every run (see '
  'lib/engine/reminders.ts). An admin-panel indicator / scheduled check flags '
  '"no activity for job_key in the last N hours" as a visible warning, N being a threshold '
  'meaningfully above the normal run interval (e.g. job runs every 5-15 minutes -> flag if '
  'silent for 2+ hours). This is a lower-severity companion to the real-time critical alerts '
  '(Ordrfy-Final-Implementation-Plan.pdf) for missed scheduler runs -- both should exist, '
  'this one is the always-queryable source of truth the other alerting reads from.';

-- System-level table, not tenant-scoped. Written by the cron job and admin/monitoring
-- routes via the service-role client; no tenant RLS policy applies.
alter table system_health enable row level security;

insert into system_health (job_key, last_run_at) values ('reminder_engine', now())
on conflict (job_key) do nothing;
