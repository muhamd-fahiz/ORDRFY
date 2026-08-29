create table reminders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  channel_id uuid not null references channels(id),
  reminder_type text not null, -- 'payment_due' | 'fee_due' | 'appointment' | 'follow_up'
  scheduled_time_utc timestamptz not null,
  message_template_id uuid references message_templates(id),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  failure_reason text, -- e.g. 'channel_unsupported', 'send_error', 'provider_error'
  attempt_count integer not null default 0,
  locked_at timestamptz,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

comment on table reminders is
  'pending -> processing -> sent/failed state machine. Atomic claiming via '
  'FOR UPDATE SKIP LOCKED (see lib/engine/reminders.ts), not a plain status check -- if two '
  'scheduler runs somehow overlap, the second simply skips any row already locked by the '
  'first. A reminder stuck in processing past a reasonable timeout is reset to pending by a '
  'periodic recovery check, incrementing attempt_count.';

comment on column reminders.failure_reason is
  'channel_unsupported is the specific, expected outcome per the Instagram -> WhatsApp '
  'consent-routing decision (docs/architecture/decisions/0001-instagram-whatsapp-consent-routing.md): '
  'no WhatsApp consent granted AND the Instagram window is closed at send time, so no '
  'compliant automated send exists on either channel. The reminder engine inserts a row into '
  'owner_attention_queue (reason=reminder_channel_unsupported, reference_type=reminder) at '
  'the same time it sets this status -- that table, not a query against reminders directly, '
  'is what the "Needs Owner Attention" admin view reads (round 3 recommendation #7). Other '
  'failure_reason values (send_error, provider_error, ...) are genuine transient failures '
  'eligible for retry via the manual recovery tools and do NOT get queued here; '
  'channel_unsupported is not retried automatically since retrying without a state change '
  '(consent granted, or window reopening) would just fail again.';

alter table reminders enable row level security;

create policy "tenant_isolation_reminders"
  on reminders for all
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

-- The exact query the scheduler runs every cycle: a partial index (pending rows only) keeps
-- it fast even as historical sent/failed reminders accumulate.
create index idx_reminders_pending_due on reminders(scheduled_time_utc)
  where status = 'pending';
create index idx_reminders_business_id on reminders(business_id);

-- Secondary: direct inspection of a specific reminder's failure state (e.g. from admin
-- recovery tooling). The canonical "Needs Owner Attention" queue query runs against
-- owner_attention_queue, not this index (see 20260828120023_owner_attention_queue.sql).
create index idx_reminders_needs_attention on reminders(business_id, created_at)
  where status = 'failed' and failure_reason = 'channel_unsupported';
