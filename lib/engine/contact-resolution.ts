import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { ChannelName } from "@/lib/channels/types";
import { getInitialPipelineStage } from "./pipeline";

type Client = SupabaseClient<Database>;

export interface ResolvedContact {
  contactId: string;
  identityId: string;
  isNewContact: boolean;
}

/**
 * The one consistent lookup regardless of channel (Ordrfy-Multi-Channel-Addendum.pdf
 * Section 3): resolve (business_id, channel_id, provider_user_id) against
 * contact_channel_identities. If no match, create both the contact and the identity
 * together, and assign the new contact to its vertical's initial pipeline stage. Never
 * match on phone number alone.
 */
export async function resolveOrCreateContact(
  supabase: Client,
  businessId: string,
  channel: ChannelName,
  providerUserId: string,
  extra: { phoneNumber?: string | null; displayHandle?: string | null },
): Promise<ResolvedContact> {
  const { data: channelRow, error: channelError } = await supabase
    .from("channels")
    .select("id")
    .eq("name", channel)
    .single();
  if (channelError) throw new Error(`Unknown channel ${channel}: ${channelError.message}`);

  const { data: existingIdentity, error: lookupError } = await supabase
    .from("contact_channel_identities")
    .select("id, contact_id")
    .eq("business_id", businessId)
    .eq("channel_id", channelRow.id)
    .eq("provider_user_id", providerUserId)
    .maybeSingle();
  if (lookupError) throw new Error(`Contact identity lookup failed: ${lookupError.message}`);

  if (existingIdentity) {
    const now = new Date().toISOString();
    // Both the identity's own last_inbound_at (the reminder engine's per-channel Instagram
    // window check reads this one) AND the contact's last_inbound_at (Today/Contacts List
    // sort by this one) must move forward on every inbound message, not just the contact's
    // first ever one -- found by testing: a contact who messaged again after their first
    // message stayed pinned at their original timestamp forever, silently breaking "most
    // recently active first" for any returning contact.
    await Promise.all([
      supabase.from("contact_channel_identities").update({ last_inbound_at: now }).eq("id", existingIdentity.id),
      supabase.from("contacts").update({ last_inbound_at: now }).eq("id", existingIdentity.contact_id),
    ]);
    return { contactId: existingIdentity.contact_id, identityId: existingIdentity.id, isNewContact: false };
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("vertical")
    .eq("id", businessId)
    .single();
  if (businessError) throw new Error(`Business lookup failed: ${businessError.message}`);

  const initialStageId = await getInitialPipelineStage(supabase, businessId, business.vertical);

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .insert({ business_id: businessId, pipeline_stage_id: initialStageId, last_inbound_at: new Date().toISOString() })
    .select("id")
    .single();
  if (contactError) throw new Error(`Contact creation failed: ${contactError.message}`);

  const { data: identity, error: identityError } = await supabase
    .from("contact_channel_identities")
    .insert({
      contact_id: contact.id,
      business_id: businessId,
      channel_id: channelRow.id,
      provider_user_id: providerUserId,
      phone_number: extra.phoneNumber ?? null,
      display_handle: extra.displayHandle ?? null,
      last_inbound_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (identityError) throw new Error(`Contact identity creation failed: ${identityError.message}`);

  return { contactId: contact.id, identityId: identity.id, isNewContact: true };
}
