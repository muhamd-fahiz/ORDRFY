-- Round 3 recommendation #7: gives "Needs Owner Attention" an actual queryable home. Before
-- this migration, that concept was scattered -- an unmatched/ambiguous inbound message had
-- no queue at all, and a reminder's channel_unsupported failure was only queryable by
-- scanning reminders directly. This table unifies every case into one place, so the admin
-- panel's oldest-first sort and always-visible count badge are both a single simple query,
-- and round 3 recommendation #9's "what counts as urgent" (new lead, payment issue, NOA
-- item) can key off inserts into this one table too.
create table owner_attention_queue (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  reason text not null check (reason in (
    'unmatched_message',        -- inbound message matched no internal_reply_rule confidently
    'ambiguous_match',          -- multiple equal-priority internal_reply_rule matches
    'media_message',            -- inbound message contains media (V1 logs metadata, ignores content)
    'reminder_channel_unsupported', -- reminders.status='failed', failure_reason='channel_unsupported'
    'manual_flag'                -- owner manually flagged this contact for their own follow-up
  )),
  reference_type text not null check (reference_type in ('message', 'reminder', 'contact')),
  reference_id uuid, -- messages.id, reminders.id, or null for a manual_flag on the contact itself
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);

comment on table owner_attention_queue is
  'The single source of truth for "needs owner attention," across every reason it can '
  'arise. Application code (Build Phase 2 shared engine) inserts a row here at the same '
  'point it would previously have just logged to activity_log -- this table is in addition '
  'to activity_log, not a replacement (activity_log is the permanent audit trail; this table '
  'is the actionable, resolvable queue). Oldest-unresolved-first = order by created_at asc '
  'where resolved_at is null. Count badge = count(*) where resolved_at is null. No full-text '
  'search or polish needed to satisfy round 3 recommendation #7 -- sort + count is enough.';

alter table owner_attention_queue enable row level security;

create policy "tenant_isolation_owner_attention_queue"
  on owner_attention_queue for all
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

-- The exact query the admin panel runs for both the list view and the count badge.
create index idx_owner_attention_queue_unresolved
  on owner_attention_queue(business_id, created_at)
  where resolved_at is null;
