import type {
  MessagingChannelProvider,
  NormalizedInboundMessage,
  OutboundContent,
  ProviderMessageId,
} from "../types";

/**
 * Logs "sent" messages to a local table instead of calling a real API, and accepts a
 * manually-triggered test payload simulating "customer sent X message" -- lets the full
 * pipeline -> auto-reply -> reminder flow be tested without any real WhatsApp number.
 *
 * verifyWebhookSignature() always returns true here (there's no real signature to check
 * in mock mode); the real InteraktAdapter's signature verification is written and
 * unit-tested against sample real payloads/signatures independently of this class, so it's
 * proven correct before it ever runs live (Ordrfy-Cost-Optimized-Stack.pdf Section 3).
 */
export interface MockWhatsAppWebhookPayload {
  fromPhoneNumber: string;
  displayName?: string;
  text: string;
  providerMessageId?: string;
}

// Test-only failure simulation, keyed by recipient (the `to` phone number sendMessage()
// receives) rather than by content -- unlike lib/ai/mock.ts's content-keyed SIMULATE_AI_ERROR
// markers, outbound content here is fixed seed data (internal_reply_rules.reply_text), not
// something a test controls directly. Exists purely so Finding 2 (Pre-Phase 7 correctness
// remediation: a provider failure could leave an outbound reply permanently stuck at
// send_status='pending_send') is verifiable at all -- sendMessage() otherwise never throws
// under any real product code path today. Never called by product code, only by verification
// scripts.
const sendFailuresRemaining = new Map<string, number>();

/** Makes the next `times` sendMessage() calls to `to` throw before succeeding normally. Test-only. */
export function simulateSendFailuresFor(to: string, times = 1): void {
  sendFailuresRemaining.set(to, times);
}

export class MockWhatsAppProvider implements MessagingChannelProvider {
  readonly channel = "whatsapp" as const;

  verifyWebhookSignature(_rawPayload: string, _signature: string | null): boolean {
    return true;
  }

  normalizeInboundMessage(rawPayload: unknown): NormalizedInboundMessage {
    const payload = rawPayload as MockWhatsAppWebhookPayload;
    return {
      channel: this.channel,
      providerUserId: payload.fromPhoneNumber,
      providerMessageId: payload.providerMessageId ?? `mock-wa-${crypto.randomUUID()}`,
      messageType: "text",
      content: payload.text,
      mediaUrl: null,
      mediaMimeType: null,
      providerMediaId: null,
      receivedAt: new Date(),
      phoneNumber: payload.fromPhoneNumber,
      displayHandle: null,
      displayName: payload.displayName ?? null,
    };
  }

  async sendMessage(to: string, content: OutboundContent): Promise<ProviderMessageId> {
    const remainingFailures = sendFailuresRemaining.get(to);
    if (remainingFailures && remainingFailures > 0) {
      sendFailuresRemaining.set(to, remainingFailures - 1);
      throw new Error(`MockWhatsAppProvider: simulated send failure (recipient=${to})`);
    }

    const providerMessageId = `mock-wa-out-${crypto.randomUUID()}`;
    // In place of a real API call: this would be persisted via the caller's messages
    // insert (send_status='sent', provider='mock', provider_message_id=<this id>).
    console.log(`[MockWhatsAppProvider] sendMessage to=${to}`, content);
    return providerMessageId;
  }

  isWindowOpen(_lastInboundAt: Date | null): boolean {
    // WhatsApp templates can send regardless of window state; callers should not gate
    // WhatsApp sends on this value the way they must for Instagram.
    return true;
  }
}
