-- Audit finding #2 (function half): claim_stuck_webhook_event() previously only reclaimed
-- status in ('received', 'processing') rows past a timeout -- a row that reached
-- status='failed' (a real, durably-recorded processing exception, as opposed to a crash
-- before processing ever started) had NO recovery path at all; nothing ever reclaimed it
-- again. Combined with processInboundMessage()'s prior duplicate-insert handling (fixed
-- separately, application-side, in this same change), a failed webhook event was previously
-- permanently unrecoverable. See docs/architecture/decisions/0037-webhook-recovery-and-audit-fixes.md.
--
-- A 'failed' row does not need the timeout wait 'received'/'processing' rows need (those
-- could still be a legitimately in-flight request; 'failed' already represents a definitively
-- finished, failed attempt) -- but it does need a retry cap, since a persistent failure cause
-- (e.g. a misconfigured provider) would otherwise be retried by every single recovery tick
-- forever. p_max_attempts mirrors reminders.ts's own MAX_ATTEMPTS=5 convention.
--
-- Dropped and recreated rather than CREATE OR REPLACE: adding a parameter changes the
-- function's signature, which CREATE OR REPLACE cannot apply to an existing signature --
-- without the explicit drop this would silently create a second, overloaded function instead
-- of replacing the original.
drop function if exists claim_stuck_webhook_event(integer);

create function claim_stuck_webhook_event(p_timeout_minutes integer default 10, p_max_attempts integer default 5)
returns webhook_events
language plpgsql
as $$
declare
  claimed webhook_events;
begin
  update webhook_events
  set status = 'processing', attempt_count = attempt_count + 1
  where id = (
    select id from webhook_events
    where (
      (status in ('received', 'processing') and received_at < now() - (p_timeout_minutes || ' minutes')::interval)
      or (status = 'failed' and attempt_count < p_max_attempts)
    )
    order by received_at
    limit 1
    for update skip locked
  )
  returning * into claimed;

  return claimed;
end;
$$;

revoke execute on function claim_stuck_webhook_event(integer, integer) from public, anon, authenticated;
grant execute on function claim_stuck_webhook_event(integer, integer) to service_role;
