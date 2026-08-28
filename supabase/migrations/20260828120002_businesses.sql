create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  vertical text not null references verticals(key),
  subscription_status text not null default 'trial'
    check (subscription_status in ('trial', 'active', 'inactive')),
  trial_ends_at timestamptz,
  timezone text not null default 'Asia/Kolkata',
  preferred_language text not null default 'en',
  automation_paused boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on column businesses.preferred_language is
  'India-fit addendum #10 (docs/decisions/2026-08-28-india-owner-fit.md): the default '
  'language internal_reply_rules/message_templates matching prefers for this business''s '
  'customers, ISO 639-1-style code (e.g. en, hi). A first-class column here, not a '
  'business_settings key, because it is as fundamental to a business''s identity as vertical '
  'or timezone, not an optional override of a numeric/behavioral default. Free text, not a '
  'CHECK-constrained enum -- which languages are actually supported is a function of which '
  'internal_reply_rules/message_templates rows exist for that language, not a hardcoded list.';

comment on column businesses.automation_paused is
  'Admin kill switch. When true, all outbound automation (auto-replies, reminders) is '
  'suppressed across every enabled channel for this business, checked as the final gate '
  'before any outbound send -- in the shared engine, before handoff to any channel adapter, '
  'so it needs no per-channel special-casing. Inbound messages are still received and logged '
  'normally while paused. Toggleable only by an authenticated admin via a service-role server '
  'route; every toggle is logged to activity_log with the admin''s identity and timestamp '
  '(Ordrfy-Hardening-Addendum.pdf Section 4).';

-- RLS enabled now; the tenant-isolation policy for this table is added in the
-- business_memberships migration immediately following, since the policy's definition
-- depends on that table existing.
alter table businesses enable row level security;
