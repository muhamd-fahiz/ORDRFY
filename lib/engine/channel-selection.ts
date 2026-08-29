/**
 * The reminder engine's channel-selection logic
 * (docs/architecture/decisions/0001-instagram-whatsapp-consent-routing.md), as a pure
 * function -- deliberately no DB access here, so
 * the branching (the part most worth getting exactly right) is unit-testable without a
 * database.
 *
 * Unified on purpose: a WhatsApp identity is eligible whenever it exists, isn't opted
 * out, AND either (a) no reminder_channel_consent row exists for it at all -- meaning it's
 * a native WhatsApp contact who never went through the Instagram consent flow, so there's
 * nothing to have consented to -- or (b) the latest consent status is 'granted'. This one
 * condition correctly handles both native WhatsApp contacts and consent-flow-derived ones
 * without special-casing either: a native contact has consentStatus=null and passes; a
 * consent-flow contact whose consent was later revoked has consentStatus='revoked' and
 * correctly fails. Preferring WhatsApp whenever eligible (checked first, before Instagram)
 * because it has no window restriction -- it's the more reliable channel whenever available.
 */

const INSTAGRAM_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ChannelIdentityInput {
  optedOutAt: string | null;
}

export interface WhatsAppIdentityInput extends ChannelIdentityInput {
  /** Latest row from current_reminder_channel_consent for this contact+whatsapp, or null if none exists. */
  consentStatus: "pending" | "granted" | "declined" | "no_response" | "revoked" | null;
}

export interface InstagramIdentityInput extends ChannelIdentityInput {
  lastInboundAt: string | null;
}

export interface ChannelSelectionInput {
  whatsapp: WhatsAppIdentityInput | null;
  instagram: InstagramIdentityInput | null;
  /** Injectable for tests; defaults to the real current time. */
  now?: Date;
}

export type ChannelSelectionResult =
  | { outcome: "whatsapp" }
  | { outcome: "instagram" }
  | { outcome: "unsupported" };

export function isInstagramWindowOpen(lastInboundAt: string | null, now: Date = new Date()): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - new Date(lastInboundAt).getTime() < INSTAGRAM_WINDOW_MS;
}

export function selectReminderChannel(input: ChannelSelectionInput): ChannelSelectionResult {
  const now = input.now ?? new Date();

  const whatsappEligible =
    input.whatsapp !== null &&
    input.whatsapp.optedOutAt === null &&
    (input.whatsapp.consentStatus === null || input.whatsapp.consentStatus === "granted");

  if (whatsappEligible) {
    return { outcome: "whatsapp" };
  }

  const instagramEligible =
    input.instagram !== null &&
    input.instagram.optedOutAt === null &&
    isInstagramWindowOpen(input.instagram.lastInboundAt, now);

  if (instagramEligible) {
    return { outcome: "instagram" };
  }

  return { outcome: "unsupported" };
}
