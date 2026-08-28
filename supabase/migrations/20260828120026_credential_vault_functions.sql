-- Hardening item (2026-08-28): business_channel_connections.credentials_ref must never
-- resolve to a raw provider token stored in plain text. Confirmed Supabase Vault
-- (supabase_vault extension, backed by pgsodium) is installed by default on this Postgres
-- image and works end-to-end (create/read/update/delete all verified manually against the
-- running local stack before writing this migration -- not assumed). vault.secrets stores
-- ciphertext; vault.decrypted_secrets decrypts on read, restricted to the postgres/
-- service_role roles at the schema level -- confirmed both anon and authenticated get an
-- explicit "permission denied for schema vault" if they try.
--
-- The `vault` schema itself is not exposed via PostgREST (only whitelisted schemas/
-- functions are), so application code -- which talks to Postgres through PostgREST even
-- when using the service-role client -- cannot call vault.* directly. These wrapper
-- functions are the actual access point: SECURITY DEFINER so they can reach the vault
-- schema regardless of the caller's own grants, with EXECUTE explicitly revoked from
-- anon/authenticated and granted only to service_role. This means the exact same
-- boundary already proven against the vault schema directly (service_role only) also
-- holds for these RPC-callable wrappers.
create or replace function store_provider_credential(p_name text, p_secret text, p_description text default null)
returns uuid
security definer
set search_path = public, vault
language plpgsql
as $$
begin
  -- vault.secrets.description is NOT NULL (default '') -- passing NULL through explicitly,
  -- rather than omitting the argument, still violates that constraint. Found while
  -- validating this migration against the running local instance.
  return vault.create_secret(p_secret, p_name, coalesce(p_description, ''));
end;
$$;

create or replace function get_provider_credential(p_secret_id uuid)
returns text
security definer
set search_path = public, vault
language plpgsql
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where id = p_secret_id;
  return v_secret;
end;
$$;

create or replace function update_provider_credential(p_secret_id uuid, p_secret text)
returns void
security definer
set search_path = public, vault
language plpgsql
as $$
begin
  perform vault.update_secret(p_secret_id, p_secret);
end;
$$;

create or replace function delete_provider_credential(p_secret_id uuid)
returns void
security definer
set search_path = public, vault
language plpgsql
as $$
begin
  delete from vault.secrets where id = p_secret_id;
end;
$$;

-- IMPORTANT: `revoke ... from public` alone is NOT sufficient here. Supabase's platform
-- setup applies a default ACL on the public schema (checked directly against this
-- project's local instance: `select * from pg_default_acl where defaclnamespace =
-- 'public'::regnamespace`) that auto-grants EXECUTE on every new function to anon,
-- authenticated, AND service_role directly -- not via the PUBLIC pseudo-role. Revoking
-- from public alone leaves those direct grants untouched, which was confirmed as a real
-- gap while validating this migration (authenticated could call store_provider_credential
-- successfully until this explicit revoke was added). Must revoke from the actual role
-- names.
revoke execute on function store_provider_credential(text, text, text) from public, anon, authenticated;
revoke execute on function get_provider_credential(uuid) from public, anon, authenticated;
revoke execute on function update_provider_credential(uuid, text) from public, anon, authenticated;
revoke execute on function delete_provider_credential(uuid) from public, anon, authenticated;

grant execute on function store_provider_credential(text, text, text) to service_role;
grant execute on function get_provider_credential(uuid) to service_role;
grant execute on function update_provider_credential(uuid, text) to service_role;
grant execute on function delete_provider_credential(uuid) to service_role;

comment on function get_provider_credential(uuid) is
  'The only sanctioned way to resolve business_channel_connections.credentials_ref back to '
  'a real token. Never call this and then log, console.log, or write the return value to '
  'activity_log/any other table -- see lib/secrets/vault.ts for the enforced call site.';
