create table business_channel_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  channel_id uuid not null references channels(id),
  provider_account_id text, -- e.g. WhatsApp number, Instagram Business Account ID
  connected boolean not null default false,
  credentials_ref text, -- Supabase Vault secret id (uuid, as text) -- see credentials_ref comment below
  disconnected_at timestamptz, -- round 4 recommendation #15: basic audit of the last disconnect
  created_at timestamptz not null default now(),
  unique (business_id, channel_id)
);

comment on column business_channel_connections.credentials_ref is
  'A Supabase Vault secret id (see 20260828120026_credential_vault_functions.sql), never a '
  'raw provider token. Confirmed end-to-end against this project''s local Postgres image '
  '(supabase_vault extension is installed by default, encryption backed by pgsodium) before '
  'committing to this approach -- create/read/update/delete all verified manually, and '
  'anon/authenticated roles confirmed unable to read vault.decrypted_secrets (explicit '
  '"permission denied for schema vault"), only service_role can. Application code resolves '
  'this via lib/secrets/vault.ts, which calls the SECURITY DEFINER wrapper functions in that '
  'migration -- never query the vault schema directly, and never log a resolved value.';

comment on column business_channel_connections.disconnected_at is
  'Set by the admin-panel disconnect/reconnect action (Build Phase 4, round 4 recommendation '
  '#15): a simple reset for a wrong-account link or an expired token, not a re-auth flow. '
  'Disconnecting clears connected/credentials_ref/provider_account_id but never touches '
  'historical messages/contacts data -- this column is just a timestamp for "when did this '
  'last happen," not a full connection-history log.';

alter table business_channel_connections enable row level security;

create policy "tenant_isolation_business_channel_connections"
  on business_channel_connections for all
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

create index idx_business_channel_connections_business_id on business_channel_connections(business_id);
