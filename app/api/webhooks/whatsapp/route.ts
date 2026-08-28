import { NextResponse, type NextRequest, after } from "next/server";
import { createServiceRoleClient } from "@/lib/db/server";
import { getChannelProvider } from "@/lib/channels/factory";
import { storeWebhookEventIfNew, markWebhookProcessed, markWebhookFailed } from "@/lib/engine/webhook-durability";
import { resolveBusinessIdFromProviderAccount } from "@/lib/engine/business-resolution";
import { processInboundMessage } from "@/lib/engine/automation";
import type { MockWhatsAppWebhookPayload } from "@/lib/channels/whatsapp/mock";

/**
 * Ordrfy-Final-Architecture.pdf Section 9, exactly: verify signature -> check duplicate ->
 * durably store (status=received) -> ack 200 -> THEN process. The `after()` callback runs
 * once the response has been sent, but the durable write already happened before that --
 * a crash during `after()` leaves the row safely in `received` for a recovery job, it does
 * not lose the inbound message. Never move the storeWebhookEventIfNew() call after the ack.
 *
 * Mock-provider payload shape for now (Build Phase 4 replaces this route's parsing with
 * the real InteraktAdapter's webhook format; the durability/processing pipeline below it
 * doesn't change).
 */
interface MockWebhookEnvelope extends MockWhatsAppWebhookPayload {
  providerEventId?: string;
  businessProviderAccountId: string;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  const provider = getChannelProvider("whatsapp");
  if (!provider.verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: MockWebhookEnvelope;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!payload.businessProviderAccountId) {
    return NextResponse.json({ error: "businessProviderAccountId is required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const providerEventId = payload.providerEventId ?? crypto.randomUUID();

  const { eventId, isDuplicate } = await storeWebhookEventIfNew(
    supabase,
    "whatsapp",
    "mock-whatsapp",
    providerEventId,
    payload,
  );

  if (isDuplicate) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  after(async () => {
    try {
      const businessId = await resolveBusinessIdFromProviderAccount(
        supabase,
        "whatsapp",
        payload.businessProviderAccountId,
      );
      if (!businessId) {
        await markWebhookFailed(supabase, eventId, "no connected business found for businessProviderAccountId");
        return;
      }

      const normalized = provider.normalizeInboundMessage(payload);
      await processInboundMessage(supabase, businessId, normalized);
      await markWebhookProcessed(supabase, eventId, businessId);
    } catch (error) {
      await markWebhookFailed(supabase, eventId, error);
    }
  });

  return NextResponse.json({ ok: true });
}
