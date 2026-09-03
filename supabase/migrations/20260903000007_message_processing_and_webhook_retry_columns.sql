-- Audit finding #2 (schema half): supports resumable webhook recovery. See
-- docs/architecture/decisions/0037-webhook-recovery-and-audit-fixes.md for the full
-- lifecycle trace this fixes.
--
-- messages.automation_processed_at: the earlier design used "does a row with this
-- (provider, provider_message_id) already exist" as a proxy for "was this message's
-- automation processing already completed" -- but that row is inserted BEFORE processing
-- even starts, so any failure after storage (an audit-write failure, a later processing
-- exception) left a stored-but-never-processed message with no way to tell it apart from a
-- genuinely finished one. NULL means either an outbound row (not applicable) or an inbound
-- row whose processing was interrupted and must be RESUMED, not skipped, on retry. Set once
-- lib/engine/automation.ts's pipeline reaches any terminal outcome without throwing.
alter table messages add column automation_processed_at timestamptz;

comment on column messages.automation_processed_at is
  'Inbound only. NULL means processing never completed for this message -- either it has not '
  'been attempted yet, or an earlier attempt was interrupted after the message was stored. A '
  'retry (see processInboundMessage''s duplicate-insert handling) must resume processing '
  'using the existing row rather than treating a NULL value here as "already handled."';

-- webhook_events.attempt_count: mirrors reminders.attempt_count's existing pattern. Needed
-- because the recovery job is being extended (this migration's companion function change) to
-- also reclaim status='failed' rows, not just stuck 'received'/'processing' ones -- without a
-- cap, a webhook event whose failure cause is persistent (e.g. a misconfigured provider) would
-- be retried by every recovery tick forever.
alter table webhook_events add column attempt_count integer not null default 0;

comment on column webhook_events.attempt_count is
  'Incremented each time claim_stuck_webhook_event() claims this row for (re)processing. '
  'Once it reaches that function''s p_max_attempts, a status=failed row stops being reclaimed '
  '-- it remains queryable and its failure is already visible via activity_log '
  '(webhook_processing_failed, written every attempt when business_id is known), but no '
  'further automated retry is attempted.';
