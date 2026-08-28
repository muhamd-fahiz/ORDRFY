create table internal_reply_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade, -- null = vertical-wide default
  vertical text not null references verticals(key),
  rule_key text not null, -- stable identifier for idempotent seeding, e.g. 'fashion_price'
  language text not null default 'en', -- ISO 639-1-style code; see column comment
  trigger_keywords text[] not null default '{}',
  trigger_priority integer not null default 0,
  reply_text text not null,
  active boolean not null default true,
  unique (business_id, vertical, rule_key, language)
);

comment on table internal_reply_rules is
  'Free-form, internal keyword-matched replies -- fire only inside an open customer-service '
  'window, no Meta approval needed. Never conflate with message_templates: approval status, '
  'category, and parameter schema do not apply to these rows (Ordrfy-Final-Architecture.pdf '
  'Section 10).';

comment on column internal_reply_rules.language is
  'India-fit addendum #10 (docs/decisions/2026-08-28-india-owner-fit.md): the same rule_key '
  'can have one row per language (e.g. fashion_price/en and fashion_price/hi are two rows, '
  'not one row with mixed content). Matching logic should prefer the contact''s business''s '
  'businesses.preferred_language, falling back to en if no row exists in that language for '
  'the matched rule_key. Only en is seeded at launch; the column exists from day one so '
  'adding hi (or any other language) later is new rows, not a migration.';

alter table internal_reply_rules enable row level security;

create policy "internal_reply_rules_readable"
  on internal_reply_rules for select
  using (
    business_id is null
    or business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

create index idx_internal_reply_rules_business_vertical on internal_reply_rules(business_id, vertical);
