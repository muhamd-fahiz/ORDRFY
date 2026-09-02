import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { ChannelName } from "@/lib/channels/types";
import { createServiceRoleClient } from "@/lib/db/server";
import { getChannelProvider } from "@/lib/channels/factory";
import { resolveBusinessIdFromProviderAccount } from "./business-resolution";
import { processInboundMessage } from "./automation";

type Client = SupabaseClient<Database>;

const MAX_RECOVERED_PER_RUN = 50;

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

export interface WebhookRecoveryResult {
  recovered: number;
  processed: number;
  failed: number;
}

/**
 * Confirmed gap fix (independent audit): a webhook_events row can be left stuck in
 * 'received' forever if the server process dies in the window between acking the provider
 * and app/api/webhooks/{whatsapp,instagram}/route.ts's after() callback finishing --
 * because the provider already got its 200, it never retries, so nothing else would ever
 * revisit that row. This re-derives everything needed to reprocess purely from the
 * already-durably-stored row (raw_payload, provider, channel_id); it does not call into or
 * modify either webhook route's own inline processing logic, which stays exactly as it was.
 *
 * Self-contained (creates its own service-role client), matching runReminderEngineOnce()'s
 * own pattern -- both are invoked from the same cron tick (app/api/cron/reminders/route.ts),
 * reusing the existing pg_cron schedule/secret/endpoint rather than a second one.
 *
 * Safe under a concurrent race with a still-legitimately-in-flight original request (in
 * practice never observed, since claim_stuck_webhook_event() only claims rows idle past the
 * timeout): processInboundMessage()'s own idempotency (the unique index on
 * messages(provider, provider_message_id)) means even a genuine double-attempt cannot
 * produce a duplicate message or a duplicate auto-reply -- the second attempt's insert
 * simply hits a 23505 and returns early, exactly as it already does for a duplicate live
 * webhook delivery.
 */
export async function recoverStuckWebhookEvents(timeoutMinutes = 10): Promise<WebhookRecoveryResult> {
  const supabase = createServiceRoleClient();
  const result: WebhookRecoveryResult = { recovered: 0, processed: 0, failed: 0 };

  for (let i = 0; i < MAX_RECOVERED_PER_RUN; i++) {
    const { data: claimed, error } = await supabase.rpc("claim_stuck_webhook_event", {
      p_timeout_minutes: timeoutMinutes,
    });
    if (error) throw new Error(`claim_stuck_webhook_event failed: ${error.message}`);
    if (!claimed || !claimed.id) break;

    result.recovered++;

    try {
      const { data: channelRow, error: channelError } = await supabase
        .from("channels")
        .select("name")
        .eq("id", claimed.channel_id)
        .single();
      if (channelError) throw new Error(`Unknown channel_id ${claimed.channel_id}: ${channelError.message}`);

      const payload = claimed.raw_payload as { businessProviderAccountId?: string } | null;
      if (!payload?.businessProviderAccountId) {
        throw new Error("raw_payload is missing businessProviderAccountId");
      }

      const channelName = channelRow.name as ChannelName;
      const businessId = await resolveBusinessIdFromProviderAccount(supabase, channelName, payload.businessProviderAccountId);
      if (!businessId) {
        await markWebhookFailed(supabase, claimed.id, "no connected business found for businessProviderAccountId");
        result.failed++;
        continue;
      }

      const provider = getChannelProvider(channelName);
      const normalized = provider.normalizeInboundMessage(claimed.raw_payload);
      await processInboundMessage(supabase, businessId, normalized);
      await markWebhookProcessed(supabase, claimed.id, businessId);
      result.processed++;
    } catch (recoverError) {
      await markWebhookFailed(supabase, claimed.id, recoverError);
      result.failed++;
    }
  }

  return result;
}
