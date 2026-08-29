import type {
  MessagingChannelProvider,
  NormalizedInboundMessage,
  OutboundContent,
  ProviderMessageId,
} from "../types";

const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Mirrors MockWhatsAppProvider's shape, but isWindowOpen() enforces the real Instagram
 * platform constraint (see CLAUDE.md "Known blockers" #4): Meta's Instagram Messaging API
 * has no compliant mechanism to message a customer outside the 24h window opened by their
 * last inbound message -- no usable message tags, no Human Agent tag (Messenger-only), no
 * Sponsored Messages / One-Time Notifications for Instagram. Reflecting this constraint in
 * the mock, not just the real adapter, means the reminder engine's full channel-selection
 * logic (WhatsApp-via-consent -> Instagram-if-window-open -> failed/channel_unsupported,
 * see docs/architecture/decisions/0001-instagram-whatsapp-consent-routing.md) gets exercised in
 * local/CI tests before any real Instagram credentials exist.
 */
export interface MockInstagramWebhookPayload {
  fromInstagramScopedId: string;
  displayHandle?: string;
  text: string;
  providerMessageId?: string;
}

export class MockInstagramProvider implements MessagingChannelProvider {
  readonly channel = "instagram" as const;

  verifyWebhookSignature(_rawPayload: string, _signature: string | null): boolean {
    return true;
  }

  normalizeInboundMessage(rawPayload: unknown): NormalizedInboundMessage {
    const payload = rawPayload as MockInstagramWebhookPayload;
    return {
      channel: this.channel,
      providerUserId: payload.fromInstagramScopedId,
      providerMessageId: payload.providerMessageId ?? `mock-ig-${crypto.randomUUID()}`,
      messageType: "text",
      content: payload.text,
      mediaUrl: null,
      mediaMimeType: null,
      providerMediaId: null,
      receivedAt: new Date(),
      phoneNumber: null,
      displayHandle: payload.displayHandle ?? null,
    };
  }

  async sendMessage(to: string, content: OutboundContent): Promise<ProviderMessageId> {
    const providerMessageId = `mock-ig-out-${crypto.randomUUID()}`;
    console.log(`[MockInstagramProvider] sendMessage to=${to}`, content);
    return providerMessageId;
  }

  isWindowOpen(lastInboundAt: Date | null): boolean {
    if (!lastInboundAt) return false;
    return Date.now() - lastInboundAt.getTime() < WINDOW_MS;
  }
}
