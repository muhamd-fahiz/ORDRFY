create table messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  channel_id uuid not null references channels(id),
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null default 'text',
  content text,
  media_url text,
  media_mime_type text,
  provider_media_id text,
  is_auto_reply boolean not null default false,
  provider text not null, -- e.g. 'interakt', 'meta_graph_api', 'mock'
  provider_message_id text, -- null until confirmed sent, for outbound rows
  outbound_idempotency_key text, -- deterministic key from (inbound_message_id, matched_rule_id)
  send_status text check (send_status in ('pending_send', 'sent', 'failed')), -- outbound only
  created_at timestamptz not null default now()
);

comment on table messages is
  'V1 explicitly ignores inbound media content: if media_url is present, metadata is logged '
  'but the message routes to Needs Owner Attention rather than being processed or replied to '
  '(Ordrfy-Final-Architecture.pdf Section 12).';

comment on column messages.outbound_idempotency_key is
  'Written BEFORE the send attempt (status pending_send) so a crash between send and '
  'confirmation is detectable on retry: the handler checks for an existing row with this key '
  'first. Distinct from provider_message_id, which is only known after a confirmed send '
  '(Ordrfy-Final-Architecture.pdf Section 8).';

alter table messages enable row level security;

create policy "tenant_isolation_messages"
  on messages for all
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

create index idx_messages_business_id on messages(business_id);

-- Powers inbound idempotency: sending the same (provider, provider_message_id) twice must
-- result in exactly one processed record.
create unique index idx_messages_provider_message_id on messages(provider, provider_message_id)
  where provider_message_id is not null;

create unique index idx_messages_outbound_idempotency_key on messages(outbound_idempotency_key)
  where outbound_idempotency_key is not null;
