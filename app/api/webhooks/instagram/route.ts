import { NextResponse, type NextRequest, after } from "next/server";
import { createServiceRoleClient } from "@/lib/db/server";
import { getChannelProvider } from "@/lib/channels/factory";
import { storeWebhookEventIfNew, markWebhookProcessed, markWebhookFailed } from "@/lib/engine/webhook-durability";
import { resolveBusinessIdFromProviderAccount } from "@/lib/engine/business-resolution";
import { processInboundMessage } from "@/lib/engine/automation";
import type { MockInstagramWebhookPayload } from "@/lib/channels/instagram/mock";

/** Same durability pattern as app/api/webhooks/whatsapp/route.ts -- see that file's comment. */
interface MockWebhookEnvelope extends MockInstagramWebhookPayload {
  providerEventId?: string;
  businessProviderAccountId: string;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  const provider = getChannelProvider("instagram");
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
    "instagram",
    "mock-instagram",
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
        "instagram",
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
