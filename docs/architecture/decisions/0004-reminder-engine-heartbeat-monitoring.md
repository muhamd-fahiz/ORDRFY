# ADR-0004: Reminder-Engine Heartbeat Monitoring via `system_health`

**Status:** Accepted (2026-08-28)

## Context

Individual reminder failures are tracked (`reminders.status = 'failed'`), but nothing detects if the *entire engine* stops running — e.g. the `pg_cron` job silently stops firing. In that scenario nothing shows as failed; nothing shows as anything. At low volume an owner might notice reminders have stopped; at real volume this becomes an invisible, systemic failure.

## Decision

`system_health(job_key, last_run_at, updated_at)` — a single row per monitored job. The reminder-claiming job (`lib/engine/reminders.ts`, `runReminderEngineOnce()`) upserts its row every run via `record_reminder_engine_heartbeat()`, verified working end-to-end against the live pg_cron schedule (real ticks confirmed reaching the app via `host.docker.internal` and updating this table).

## Alternatives Considered

- **Rely solely on the real-time Sentry Cron Monitoring alert** named in the Final-Implementation-Plan. Not rejected, but this table is complementary, not a replacement — it's the queryable source of truth an admin-panel indicator or scheduled check can read from directly, independent of whether an external alerting integration is configured.

## Consequences

Still to do (Build Phase 2/5): the actual admin-panel indicator / scheduled check reading this table and flagging staleness above a threshold (e.g. no activity for 2+ hours against a 5–15 minute run interval).
