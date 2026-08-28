/**
 * Shared channel abstraction (Ordrfy-Multi-Channel-Addendum.pdf Section 1).
 *
 * The shared engine (pipeline, templates, reminders, payments, dashboard, tenant
 * isolation, audit logging, kill switch) is completely unaware of which channel a message
 * came from beyond a channel tag on the record. Channel differences live entirely inside
 * adapters implementing this interface -- never inside shared-engine logic.
 *
 * WhatsApp and Instagram cannot share webhook-handling code (different signature schemes,
 * different payload shapes, different access-token models) -- only this normalized shape
 * and everything downstream of it is shared.
 */

export type ChannelName = "whatsapp" | "instagram" | "facebook";

export interface NormalizedInboundMessage {
  channel: ChannelName;
  providerUserId: string; // WhatsApp phone number, or Instagram-scoped user id
  providerMessageId: string;
  messageType: "text" | "image" | "video" | "audio" | "document" | "other";
  content: string | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  providerMediaId: string | null;
  receivedAt: Date;
  /** Populated only when the provider payload includes it directly (e.g. WhatsApp phone). */
  phoneNumber: string | null;
  /** Populated only for Instagram (@handle), when available in the payload. */
  displayHandle: string | null;
}

export type ProviderMessageId = string;

export interface OutboundContent {
  /** Free-form text, used only when sending is permitted without an approved template
   *  (inside an open customer-service window). */
  text?: string;
  /** Required for any WhatsApp send outside the open window; ignored by providers that
   *  don't use a template mechanism. */
  templateName?: string;
  templateParameters?: Record<string, string>;
}

export interface MessagingChannelProvider {
  readonly channel: ChannelName;

  /** Verifies the provider's webhook signature. Must run BEFORE any database write. */
  verifyWebhookSignature(rawPayload: string, signature: string | null): boolean;

  /** Converts a raw, already-verified webhook payload into the shared internal shape. */
  normalizeInboundMessage(rawPayload: unknown): NormalizedInboundMessage;

  /**
   * Sends a message. Returns the provider's message id on confirmed acceptance.
   * Callers are responsible for idempotency (see lib/engine/outbound-idempotency.ts) --
   * this method itself does not deduplicate.
   */
  sendMessage(to: string, content: OutboundContent): Promise<ProviderMessageId>;

  /**
   * Whether this contact's messaging window is currently open, i.e. sending free-form
   * content (not a template) is permitted right now. Always true for a provider without a
   * window concept; for Instagram this reflects the real Meta platform constraint that
   * there is no compliant way to message outside this window at all (see
   * CLAUDE.md "Known blockers" #4). WhatsApp providers should treat template-eligible
   * sends as always available regardless of this value.
   */
  isWindowOpen(lastInboundAt: Date | null): boolean;
}
