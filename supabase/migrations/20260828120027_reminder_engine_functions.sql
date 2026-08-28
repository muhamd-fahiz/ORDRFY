-- Build Phase 2 (Shared Engine): the reminder-claiming primitive. FOR UPDATE SKIP LOCKED
-- can't be expressed through PostgREST's query builder -- it has to be a real SQL
-- statement, so this is an RPC-callable function, service_role only (same default-ACL
-- lesson learned in 20260828120026: revoke from anon/authenticated explicitly, not just
-- public).
--
-- Claims exactly one due reminder per call; lib/engine/reminders.ts loops calling this
-- until it returns null. If two scheduler runs somehow overlap, the second's call simply
-- skips whatever the first already locked -- no external locking system needed
-- (Ordrfy-Final-Architecture.pdf Section 7).
create or replace function claim_next_reminder()
returns reminders
language plpgsql
as $$
declare
  claimed reminders;
begin
  update reminders
  set status = 'processing', locked_at = now()
  where id = (
    select id from reminders
    where status = 'pending' and scheduled_time_utc <= now()
    order by scheduled_time_utc
    limit 1
    for update skip locked
  )
  returning * into claimed;

  return claimed;
end;
$$;

-- Crash recovery: a reminder stuck in 'processing' past a reasonable timeout (the job that
-- claimed it crashed before finishing) is reset to 'pending', incrementing attempt_count so
-- the retry-backoff logic in lib/engine/reminders.ts can act on it. Called once at the start
-- of every scheduled run, before claiming new work.
create or replace function recover_stuck_reminders(p_timeout_minutes integer default 10)
returns integer
language plpgsql
as $$
declare
  recovered_count integer;
begin
  with recovered as (
    update reminders
    set status = 'pending', locked_at = null, attempt_count = attempt_count + 1
    where status = 'processing'
      and locked_at < now() - (p_timeout_minutes || ' minutes')::interval
    returning id
  )
  select count(*) into recovered_count from recovered;

  return recovered_count;
end;
$$;

-- Heartbeat: upserted by the scheduler on every run (success or failure) so a silently
-- stopped engine is detectable (round 3 recommendation #3) -- no individual reminder's
-- status can reveal that on its own.
create or replace function record_reminder_engine_heartbeat()
returns void
language plpgsql
as $$
begin
  insert into system_health (job_key, last_run_at, updated_at)
  values ('reminder_engine', now(), now())
  on conflict (job_key) do update set last_run_at = now(), updated_at = now();
end;
$$;

revoke execute on function claim_next_reminder() from public, anon, authenticated;
revoke execute on function recover_stuck_reminders(integer) from public, anon, authenticated;
revoke execute on function record_reminder_engine_heartbeat() from public, anon, authenticated;

grant execute on function claim_next_reminder() to service_role;
grant execute on function recover_stuck_reminders(integer) to service_role;
grant execute on function record_reminder_engine_heartbeat() to service_role;
