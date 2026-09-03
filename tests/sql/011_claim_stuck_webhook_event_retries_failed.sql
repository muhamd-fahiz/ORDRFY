-- Audit finding #2 (function-level unit coverage), extended by the final hardening pass for
-- finding #1: confirms claim_stuck_webhook_event() reclaims a status='failed' row
-- immediately (no timeout wait needed -- 'failed' already represents a definitively finished
-- attempt, unlike 'received'/'processing' which could still be legitimately in-flight),
-- reclaims a stuck 'received'/'processing' row past its timeout, increments attempt_count on
-- every claim, and -- critically -- stops reclaiming ANY of the three states once
-- attempt_count reaches p_max_attempts. The original fix only capped the 'failed' branch;
-- 'received'/'processing' had no cap at all and could be reclaimed past its timeout forever.
-- The full end-to-end resumption behavior (processInboundMessage actually completing on a
-- resumed attempt) is covered separately by scripts/verify-webhook-recovery-resumption.mjs;
-- this test is the fast, DB-only check of the claiming logic itself.
--
-- Each claim is immediately followed by a simulated outcome (status='processed'), exactly
-- mirroring what the real lib/engine/webhook-durability.ts loop does (claim, then process,
-- then markWebhookProcessed/markWebhookFailed) BEFORE ever claiming again -- without this, a
-- row whose received_at is already past the timeout would be immediately reclaimable again
-- on the very next call within this same test, since received_at never changes on claim.
-- Asserts the final SET of claimed vs. never-claimed rows, not a specific claim ORDER --
-- claim_stuck_webhook_event() orders eligible candidates oldest-received_at-first with no
-- status-based priority.
begin;

create or replace function pg_temp.assert(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not condition then
    raise exception 'ASSERTION FAILED: %', message;
  end if;
end;
$$;

-- claim_stuck_webhook_event() is global -- it has no tenant/business scoping to filter by --
-- so any leftover 'received'/'processing'/'failed' row from other tests or manual runs
-- against this shared dev database would make which row gets claimed non-deterministic.
-- Safe to clear here: this whole test runs inside one transaction that rolls back at the end,
-- and nothing else references webhook_events by foreign key.
delete from webhook_events;

insert into webhook_events (id, channel_id, provider, provider_event_id, status, attempt_count, received_at, raw_payload)
values
  -- Reclaimable: failed needs no timeout at all.
  ('f1000000-0000-0000-0000-000000000001', (select id from channels where name = 'whatsapp'), 'mock-whatsapp', 'claim-test-failed-fresh', 'failed', 0, now(), '{}'::jsonb),
  -- NOT reclaimable: failed, but already at the attempt cap.
  ('f2000000-0000-0000-0000-000000000002', (select id from channels where name = 'whatsapp'), 'mock-whatsapp', 'claim-test-failed-capped', 'failed', 5, now(), '{}'::jsonb),
  -- NOT reclaimable: received, but not yet past the 10-minute timeout.
  ('f3000000-0000-0000-0000-000000000003', (select id from channels where name = 'whatsapp'), 'mock-whatsapp', 'claim-test-received-fresh', 'received', 0, now(), '{}'::jsonb),
  -- Reclaimable: received, stuck well past the timeout, under the attempt cap.
  ('f4000000-0000-0000-0000-000000000004', (select id from channels where name = 'whatsapp'), 'mock-whatsapp', 'claim-test-received-stuck', 'received', 2, now() - interval '20 minutes', '{}'::jsonb),
  -- NOT reclaimable: processing, stuck well past the timeout, but already at the attempt cap
  -- -- this is audit finding #1's actual regression case: the original fix capped 'failed'
  -- but not this state, so this exact row would have been reclaimed forever before the fix.
  ('f5000000-0000-0000-0000-000000000005', (select id from channels where name = 'whatsapp'), 'mock-whatsapp', 'claim-test-processing-capped', 'processing', 5, now() - interval '20 minutes', '{}'::jsonb);

create temporary table claimed_log (id uuid);

do $$
declare
  claimed webhook_events;
  iterations integer := 0;
begin
  loop
    iterations := iterations + 1;
    if iterations > 10 then
      raise exception 'ASSERTION FAILED: claim loop did not terminate within 10 iterations -- something is being reclaimed repeatedly';
    end if;
    claimed := claim_stuck_webhook_event(10, 5);
    exit when claimed.id is null;
    insert into claimed_log values (claimed.id);
    -- Simulate the real recovery loop recording an outcome immediately, before claiming
    -- again -- see header comment.
    update webhook_events set status = 'processed' where id = claimed.id;
  end loop;
end $$;

select pg_temp.assert(
  (select count(*) from claimed_log) = 2,
  'exactly 2 rows should have been claimable across the whole sweep'
);
select pg_temp.assert(
  (select count(*) from claimed_log where id = 'f1000000-0000-0000-0000-000000000001') = 1,
  'the fresh failed row should have been claimed exactly once'
);
select pg_temp.assert(
  (select count(*) from claimed_log where id = 'f4000000-0000-0000-0000-000000000004') = 1,
  'the stuck-past-timeout, under-cap received row should have been claimed exactly once'
);
select pg_temp.assert(
  (select count(*) from claimed_log where id in (
    'f2000000-0000-0000-0000-000000000002', 'f3000000-0000-0000-0000-000000000003', 'f5000000-0000-0000-0000-000000000005'
  )) = 0,
  'none of the capped/not-yet-timed-out rows should ever have been claimed'
);

select pg_temp.assert(
  (select attempt_count from webhook_events where id = 'f1000000-0000-0000-0000-000000000001') = 1,
  'f1''s attempt_count should have incremented from 0 to 1'
);
select pg_temp.assert(
  (select attempt_count from webhook_events where id = 'f4000000-0000-0000-0000-000000000004') = 3,
  'f4''s attempt_count should have incremented from 2 to 3'
);
select pg_temp.assert(
  (select attempt_count from webhook_events where id = 'f2000000-0000-0000-0000-000000000002') = 5,
  'the failed-and-capped row''s attempt_count must be unchanged'
);
select pg_temp.assert(
  (select status from webhook_events where id = 'f5000000-0000-0000-0000-000000000005') = 'processing'
    and (select attempt_count from webhook_events where id = 'f5000000-0000-0000-0000-000000000005') = 5,
  'the processing-and-capped row must be left exactly as seeded -- never reclaimed despite being well past its timeout (finding #1''s regression case)'
);

do $$ begin raise notice 'claim_stuck_webhook_event retry-cap test (all three reclaimable states): PASSED'; end $$;

rollback;
