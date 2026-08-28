import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { ChannelName } from "@/lib/channels/types";

type Client = SupabaseClient<Database>;

/**
 * The webhook has to look up which business owns the receiving account (WhatsApp number /
 * Instagram Business Account id) before a business_id is even resolved -- this lookup
 * itself runs via the service-role client, bypassing RLS, since it isn't running as any
 * particular authenticated user (Ordrfy-Final-Architecture.pdf Section 4).
 */
export async function resolveBusinessIdFromProviderAccount(
  supabase: Client,
  channel: ChannelName,
  providerAccountId: string,
): Promise<string | null> {
  const { data: channelRow } = await supabase.from("channels").select("id").eq("name", channel).single();
  if (!channelRow) return null;

  const { data: connection } = await supabase
    .from("business_channel_connections")
    .select("business_id")
    .eq("channel_id", channelRow.id)
    .eq("provider_account_id", providerAccountId)
    .eq("connected", true)
    .maybeSingle();

  return connection?.business_id ?? null;
}
