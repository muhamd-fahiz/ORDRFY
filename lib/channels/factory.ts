import type { ChannelName, MessagingChannelProvider } from "./types";
import { MockWhatsAppProvider } from "./whatsapp/mock";
import { MockInstagramProvider } from "./instagram/mock";

/**
 * Vertical/pipeline/reminder/payment logic must obtain a provider only through this
 * factory, never by importing a concrete adapter directly -- this is what keeps a future
 * BSP switch or provider swap a config change (env var), not a code change
 * (Non-Negotiable Architecture Rule 6; Ordrfy-Final-Implementation-Plan.pdf,
 * "WhatsApp Provider" upgrade path).
 */
export function getChannelProvider(channel: ChannelName): MessagingChannelProvider {
  switch (channel) {
    case "whatsapp": {
      const mode = process.env.WHATSAPP_PROVIDER ?? "mock";
      if (mode === "mock") return new MockWhatsAppProvider();
      throw new Error(
        `WHATSAPP_PROVIDER=${mode} not implemented yet -- InteraktAdapter is Build Order Phase 4.`,
      );
    }
    case "instagram": {
      const mode = process.env.INSTAGRAM_PROVIDER ?? "mock";
      if (mode === "mock") return new MockInstagramProvider();
      throw new Error(
        `INSTAGRAM_PROVIDER=${mode} not implemented yet -- direct Meta Graph API adapter is Build Order Phase 4.`,
      );
    }
    case "facebook":
      throw new Error(
        "Facebook Messenger is architecture-ready but explicitly not built in V1 (Non-Negotiable Architecture Rule / Final Locked Facts).",
      );
    default: {
      const exhaustiveCheck: never = channel;
      throw new Error(`Unknown channel: ${exhaustiveCheck}`);
    }
  }
}
