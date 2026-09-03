-- Audit finding #1: the retry cap (attempt_count < p_max_attempts) previously only guarded
-- the status='failed' branch. The status IN ('received','processing') branch had no cap at
-- all -- a webhook event stuck in one of those states past the timeout would be reclaimed,
-- and reclaimed again, and again, forever, every time the timeout re-elapsed. Same
-- CREATE OR REPLACE signature as before (no parameter change needed this time), so no drop
-- is required.
create or replace function claim_stuck_webhook_event(p_timeout_minutes integer default 10, p_max_attempts integer default 5)
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
    where attempt_count < p_max_attempts
      and (
        (status in ('received', 'processing') and received_at < now() - (p_timeout_minutes || ' minutes')::interval)
        or status = 'failed'
      )
    order by received_at
    limit 1
    for update skip locked
  )
  returning * into claimed;

  return claimed;
end;
$$;
