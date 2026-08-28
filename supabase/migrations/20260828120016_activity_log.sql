create table activity_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  event_type text not null,
  event_detail jsonb,
  actor_user_id uuid references auth.users(id), -- null for automation-driven events
  created_at timestamptz not null default now()
);

comment on table activity_log is
  'Covers customer-facing events (inquiry_received, auto_reply_sent, stage_changed, '
  'reminder_sent, payment_marked_paid) AND automation/webhook/admin events (which template '
  'matched and why, webhook processing failures, admin vertical reassignment, kill-switch '
  'pause/unpause with admin identity and timestamp). This is the primary debugging tool for '
  'live customer issues -- "why didn''t this customer get a reply?" becomes a queryable '
  'question, not a guess. Store references (message ids, template names) rather than '
  'duplicating full message text where the text itself isn''t needed for the log''s purpose.';

comment on column activity_log.actor_user_id is
  'Added round 4 recommendation #17 (docs/decisions/2026-08-28-operational-loose-ends.md), '
  'generalized beyond just payments: a first-class column rather than an ad-hoc jsonb key, '
  'since "who did this" recurs structurally across kill-switch pause/unpause (Hardening '
  'Addendum Section 4), admin vertical reassignment, channel reconnection (round 4 rec. '
  '#15), and now manual payment-status changes -- a payment marked paid from a manually '
  'reviewed UPI screenshot is exactly the kind of action that needs a "who and when" audit '
  'trail if a customer later disputes it. Null for automation-driven events (auto-reply '
  'sent, reminder sent) -- there is no human actor for those.';

alter table activity_log enable row level security;

create policy "tenant_isolation_activity_log"
  on activity_log for all
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

create index idx_activity_log_business_created on activity_log(business_id, created_at);
