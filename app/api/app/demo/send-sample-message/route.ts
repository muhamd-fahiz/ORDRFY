import { NextResponse } from "next/server";
import { getOwnerSessionState } from "@/lib/auth/owner-guard";
import { createRlsClient } from "@/lib/db/server";
import { processInboundMessage } from "@/lib/engine/automation";
import { DEMO_CHANNEL, DEMO_CUSTOMER_DISPLAY_NAME, DEMO_PROVIDER_USER_ID, DEMO_SAMPLE_MESSAGES } from "@/lib/demo/sample-messages";
import type { VerticalKey } from "@/lib/design/verticals";

/**
 * "Try Ordrfy" (post-onboarding First Value phase). Feeds one vertical-appropriate sample
 * customer message through the real, unmodified inbound pipeline -- processInboundMessage()
 * is the exact function app/api/webhooks/whatsapp/route.ts calls after durably storing a
 * real webhook payload. There is no separate demo/simulation engine.
 *
 * Deliberately bypasses business_channel_connections entirely: processInboundMessage() only
 * ever needs a businessId, which this route already has from the authenticated owner's own
 * session -- there is no external provider account to resolve, unlike a real webhook. Never
 * touching business_channel_connections keeps "tried the demo" and "a real channel is
 * connected" two clearly separate, honest states (no row here ever implies a real channel).
 *
 * Runs the entire pipeline through the RLS-scoped client (createRlsClient()), never
 * service-role -- every table processInboundMessage() touches (contacts,
 * contact_channel_identities, messages, channels, internal_reply_rules, pipeline_stages,
 * owner_attention_queue, activity_log, business_settings, opt_out_keywords) already carries
 * the standard tenant-isolation RLS policy ("business_id is null or the caller's own"),
 * verified by inspecting each migration before writing this route. If any policy ever blocks
 * part of this pipeline for a legitimately signed-in owner acting on their own business, that
 * is a real bug to fix at the RLS layer -- this route must never paper over it by falling
 * back to a service-role client, so failures are left to propagate and are reported below,
 * not swallowed.
 */
export async function POST() {
  const state = await getOwnerSessionState();
  if (state.status !== "ready") {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const sample = DEMO_SAMPLE_MESSAGES[state.vertical as VerticalKey];
  if (!sample) {
    return NextResponse.json({ error: `No sample message configured for vertical "${state.vertical}".` }, { status: 500 });
  }

  const supabase = await createRlsClient();

  try {
    await processInboundMessage(supabase, state.businessId, {
      channel: DEMO_CHANNEL,
      providerUserId: DEMO_PROVIDER_USER_ID,
      providerMessageId: `demo-${crypto.randomUUID()}`,
      messageType: "text",
      content: sample.text,
      mediaUrl: null,
      mediaMimeType: null,
      providerMediaId: null,
      receivedAt: new Date(),
      // Deliberately no phone number / handle -- this identity isn't a real WhatsApp
      // contact, so it must never look like one in contact_channel_identities.
      phoneNumber: null,
      displayHandle: null,
      displayName: DEMO_CUSTOMER_DISPLAY_NAME,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `The sample message could not be processed: ${message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
