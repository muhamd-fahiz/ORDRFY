create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id),
  provider text not null,
  provider_event_id text,
  business_id uuid references businesses(id), -- nullable: not yet resolved when first stored
  raw_payload jsonb not null,
  status text not null default 'received'
    check (status in ('received', 'processing', 'processed', 'failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

comment on table webhook_events is
  'The durable-store-before-acknowledge table. Flow: verify signature -> check '
  '(provider, provider_event_id) for an existing row (if duplicate, ack and stop, do not '
  'reprocess) -> INSERT here with status=received -> return 200 to the provider -> THEN '
  'process. A crash after storage but before processing leaves the row safely in received '
  'status for a recovery job to find and reprocess -- never acknowledge before this insert '
  'completes. This was an explicit correction to an earlier waitUntil()-first design: '
  'acknowledging before storing risks the BSP never retrying while the automation that was '
  'supposed to process the event is permanently lost, with no recovery path.';

-- No tenant RLS policy: this table is written/read exclusively by webhook and cron routes
-- running as trusted server code via the service-role client, sometimes before a business_id
-- is even resolved (the webhook has to look up which business owns the receiving number).
alter table webhook_events enable row level security;

create unique index idx_webhook_events_provider_event
  on webhook_events(provider, provider_event_id) where provider_event_id is not null;
create index idx_webhook_events_status on webhook_events(status)
  where status in ('received', 'processing');
