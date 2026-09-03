-- Final Phase 2 hardening pass (audit finding #2, docs/architecture/decisions/0038-phase2-final-hardening.md):
-- automation_processed_at alone cannot prevent two concurrent attempts (a live webhook
-- retry-delivery racing a recovery job tick, or two overlapping recovery ticks) from both
-- seeing NULL and both running the automation pipeline for the same message. A real atomic
-- claim needs a second timestamp: automation_claimed_at is set by whichever caller wins the
-- single atomic UPDATE ... WHERE automation_processed_at IS NULL AND (automation_claimed_at
-- IS NULL OR automation_claimed_at < <stale threshold>) that lib/engine/automation.ts now
-- performs before ever calling runAutomationPipeline. A losing caller (0 rows affected) does
-- nothing further -- either the message is already done, or another attempt already holds a
-- live claim and will finish it, or that claim is not yet stale enough to reclaim.
alter table messages add column automation_claimed_at timestamptz;

comment on column messages.automation_claimed_at is
  'Inbound only. Set by whichever caller atomically wins the claim UPDATE in '
  'lib/engine/automation.ts before running the automation pipeline. A NULL or sufficiently '
  'stale value (see that file''s MESSAGE_CLAIM_STALE_MS) makes the message claimable again -- '
  'this is what makes crash recovery and concurrent-attempt safety the same mechanism, not '
  'two separate ones.';
