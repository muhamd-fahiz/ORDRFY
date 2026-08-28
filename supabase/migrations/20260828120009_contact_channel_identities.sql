create table contact_channel_identities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  channel_id uuid not null references channels(id),
  provider_user_id text not null, -- WhatsApp phone number / Instagram-scoped user id
  phone_number text,   -- populated for WhatsApp; null for Instagram-only identities
  display_handle text, -- populated for Instagram (@handle); null for WhatsApp
  provider_metadata jsonb,
  last_inbound_at timestamptz, -- per-channel window state -- drives the Instagram 24h-window
                                -- check at reminder send time (see CLAUDE.md "Known blockers" #4)
  opted_out_at timestamptz, -- India-fit addendum #11: set when an opt-out phrase is detected
                             -- on this channel identity; per-channel, since opting out on
                             -- WhatsApp doesn't imply opting out on Instagram too
  created_at timestamptz not null default now(),
  unique (business_id, channel_id, provider_user_id)
);

comment on table contact_channel_identities is
  'One row per channel a contact has used. The unique (business_id, channel_id, '
  'provider_user_id) constraint is the actual inbound-message resolution lookup key -- never '
  'a phone-number-only match. No automatic cross-channel merge in V1: the same real person '
  'messaging on both WhatsApp and Instagram is two separate contacts rows unless an owner '
  'manually links them (V1.5). Incorrectly auto-merging two different customers is a worse '
  'failure mode than occasionally showing one real customer as two pipeline entries '
  '(Ordrfy-Multi-Channel-Addendum.pdf Section 3).';

comment on column contact_channel_identities.opted_out_at is
  'India-fit addendum #11 (docs/decisions/2026-08-28-india-owner-fit.md): once set, the '
  'reminder engine and the auto-reply engine must both treat this channel identity as '
  'send-ineligible -- one more condition in the same data-driven send-eligibility check as '
  'the WhatsApp-consent and Instagram-window checks (docs/decisions/'
  '2026-08-28-instagram-whatsapp-consent-routing.md), not a separate code path. Detection '
  'source: opt_out_keywords matched against an inbound message. Logged to activity_log so '
  'the owner understands why sends silently stopped, rather than assuming a bug.';

alter table contact_channel_identities enable row level security;

create policy "tenant_isolation_contact_channel_identities"
  on contact_channel_identities for all
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

create index idx_contact_channel_identities_contact_id on contact_channel_identities(contact_id);
