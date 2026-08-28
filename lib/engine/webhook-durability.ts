import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { ChannelName } from "@/lib/channels/types";

type Client = SupabaseClient<Database>;

/**
 * verify signature -> durably store -> ack 200 -> THEN process (Non-Negotiable
 * Architecture Rule 4). This function is step 2 (store); the caller must have already
 * verified the signature before calling it, and must ack only after it resolves. Never
 * ack before this write completes.
 */
export async function storeWebhookEventIfNew(
  supabase: Client,
  channel: ChannelName,
  provider: string,
  providerEventId: string,
  rawPayload: unknown,
): Promise<{ eventId: string; isDuplicate: boolean }> {
  const { data: channelRow, error: channelError } = await supabase
    .from("channels")
    .select("id")
    .eq("name", channel)
    .single();
  if (channelError) throw new Error(`Unknown channel ${channel}: ${channelError.message}`);

  const { data: existing } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("provider", provider)
    .eq("provider_event_id", providerEventId)
    .maybeSingle();
  if (existing) return { eventId: existing.id, isDuplicate: true };

  const { data: inserted, error: insertError } = await supabase
    .from("webhook_events")
    .insert({
      channel_id: channelRow.id,
      provider,
      provider_event_id: providerEventId,
      raw_payload: rawPayload as Database["public"]["Tables"]["webhook_events"]["Insert"]["raw_payload"],
      status: "received",
    })
    .select("id")
    .single();

  if (insertError) {
    // Concurrent duplicate delivery raced us to the unique (provider, provider_event_id)
    // index -- the other request's insert won, this one didn't need to.
    if (insertError.code === "23505") {
      const { data: raceExisting } = await supabase
        .from("webhook_events")
        .select("id")
        .eq("provider", provider)
        .eq("provider_event_id", providerEventId)
        .single();
      return { eventId: raceExisting!.id, isDuplicate: true };
    }
    throw new Error(`Failed to durably store webhook event: ${insertError.message}`);
  }

  return { eventId: inserted.id, isDuplicate: false };
}

export async function markWebhookProcessed(supabase: Client, eventId: string, businessId?: string): Promise<void> {
  await supabase
    .from("webhook_events")
    .update({ status: "processed", processed_at: new Date().toISOString(), ...(businessId ? { business_id: businessId } : {}) })
    .eq("id", eventId);
}

export async function markWebhookFailed(supabase: Client, eventId: string, error: unknown): Promise<void> {
  await supabase.from("webhook_events").update({ status: "failed" }).eq("id", eventId);

  // activity_log.business_id is NOT NULL -- if the event never got far enough to resolve
  // which business it belongs to, there's nowhere valid to log this to yet. The event
  // stays queryable in webhook_events(status='failed') regardless.
  const { data: event } = await supabase.from("webhook_events").select("business_id").eq("id", eventId).single();
  if (event?.business_id) {
    await supabase.from("activity_log").insert({
      business_id: event.business_id,
      event_type: "webhook_processing_failed",
      event_detail: { webhook_event_id: eventId, error: String(error) },
    });
  }
}
