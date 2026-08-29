create table message_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade, -- null = vertical-wide default
  vertical text not null references verticals(key),
  channel_id uuid not null references channels(id),
  template_key text not null, -- stable identifier for idempotent seeding, e.g. 'fashion_payment_due'
  language text not null default 'en', -- ISO 639-1-style code; see column comment
  meta_template_name text,
  meta_template_id text,
  category text check (category in ('marketing', 'utility', 'authentication')),
  approval_status text,
  parameters_schema jsonb,
  reply_text text, -- used directly for an Instagram send when the window is open; WhatsApp
                    -- sends always go via the approved Meta template referenced above
  active boolean not null default true,
  unique (business_id, vertical, channel_id, template_key, language)
);

comment on column message_templates.language is
  'India-fit addendum #10: same convention as internal_reply_rules.language. Note WhatsApp '
  'template rows additionally have a real Meta-side language requirement per '
  'meta_template_id -- when real templates are submitted (Build Phase 4), this column must '
  'match what was actually approved for that meta_template_id, not be set independently.';

comment on table message_templates is
  'Renamed from the source docs'' whatsapp_templates: this table is genuinely channel-agnostic '
  'now. WhatsApp rows: a real Meta-approved template, required for any business-initiated '
  'send outside the 24h customer-service window (meta_template_id/approval_status/category/'
  'parameters_schema all apply). Any WhatsApp row used by the reminder engine MUST have '
  'category = utility -- enforced by a trigger on reminders, not just this comment (see '
  '20260828120020_reminder_template_category_guard.sql; round 2 recommendation #1). '
  'Instagram rows: NOT a real approval-gated template. Confirmed via Meta''s own developer '
  'documentation (2026-08) that the Instagram Messaging API has no compliant mechanism to '
  'send outside its 24h window at all -- no usable message tags (most deprecated April '
  '2026), no Human Agent tag (Messenger-only), no Sponsored Messages or One-Time '
  'Notifications for Instagram. Instagram rows here just hold the reply_text used IF the '
  'window happens to be open at send time, or if the contact has granted WhatsApp consent '
  'the reminder routes there instead -- see '
  'docs/architecture/decisions/0001-instagram-whatsapp-consent-routing.md.';

alter table message_templates enable row level security;

create policy "message_templates_readable"
  on message_templates for select
  using (
    business_id is null
    or business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

create index idx_message_templates_business_vertical_channel
  on message_templates(business_id, vertical, channel_id);
