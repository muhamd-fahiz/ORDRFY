import { createServiceRoleClient } from "@/lib/db/server";

/**
 * The ONLY sanctioned way to read/write provider credentials (WhatsApp/Instagram API
 * tokens, etc.). Backed by Supabase Vault -- confirmed installed by default on this
 * project's Postgres image and working end-to-end before this module was written (see the
 * comment on business_channel_connections.credentials_ref). Calls the SECURITY DEFINER
 * wrapper functions in 20260828120026_credential_vault_functions.sql via RPC, since the
 * `vault` schema itself is not exposed through PostgREST.
 *
 * Server-only, like createServiceRoleClient() itself. Never import this from a Client
 * Component. Never log, console.log, or persist (activity_log included) the return value
 * of getProviderCredential() -- only pass it directly to the provider API call that needs it.
 */

export async function storeProviderCredential(
  name: string,
  secret: string,
  description?: string,
): Promise<string> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("store_provider_credential", {
    p_name: name,
    p_secret: secret,
    p_description: description,
  });
  if (error) throw new Error(`Failed to store provider credential: ${error.message}`);
  return data as string;
}

export async function getProviderCredential(secretId: string): Promise<string> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("get_provider_credential", {
    p_secret_id: secretId,
  });
  if (error) throw new Error(`Failed to retrieve provider credential: ${error.message}`);
  if (!data) throw new Error(`No credential found for secret id ${secretId}`);
  return data as string;
}

export async function updateProviderCredential(secretId: string, secret: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.rpc("update_provider_credential", {
    p_secret_id: secretId,
    p_secret: secret,
  });
  if (error) throw new Error(`Failed to update provider credential: ${error.message}`);
}

export async function deleteProviderCredential(secretId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.rpc("delete_provider_credential", {
    p_secret_id: secretId,
  });
  if (error) throw new Error(`Failed to delete provider credential: ${error.message}`);
}
