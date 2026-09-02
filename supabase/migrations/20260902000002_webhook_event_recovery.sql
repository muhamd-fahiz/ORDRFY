-- Missing recovery mechanism for webhook_events (confirmed gap, independent audit): that
-- table's own migration comment (20260828120017) already describes the intended design --
-- "A crash after storage but before processing leaves the row safely in received status for
-- a recovery job to find and reprocess" -- but no such job was ever built. Mirrors
-- claim_next_reminder() (20260828120027) exactly: a single-row, service-role-only claim via
-- FOR UPDATE SKIP LOCKED, looped by TypeScript code until nothing stale remains.
--
-- Matches on status in ('received', 'processing') -- 'received' is the normal "not finished
-- yet" state; 'processing' is included too so a recovery attempt that itself dies mid-
-- reprocess is picked up again on a later run (received_at never changes once set, so it
-- remains a reliable "how long has this been unresolved" clock regardless of how many
-- recovery attempts have already touched it -- no separate locked_at column needed, unlike
-- reminders, since there is no concurrent multi-worker claiming scenario to protect against
-- here, only "did the one attempt that had this event ever finish").
create or replace function claim_stuck_webhook_event(p_timeout_minutes integer default 10)
returns webhook_events
language plpgsql
as $$
declare
  claimed webhook_events;
begin
  update webhook_events
  set status = 'processing'
  where id = (
    select id from webhook_events
    where status in ('received', 'processing')
      and received_at < now() - (p_timeout_minutes || ' minutes')::interval
    order by received_at
    limit 1
    for update skip locked
  )
  returning * into claimed;

  return claimed;
end;
$$;

revoke execute on function claim_stuck_webhook_event(integer) from public, anon, authenticated;
grant execute on function claim_stuck_webhook_event(integer) to service_role;
