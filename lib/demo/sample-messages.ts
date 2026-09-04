import type { VerticalKey } from "@/lib/design/verticals";
import type { ChannelName } from "@/lib/channels/types";

/**
 * "Try Ordrfy" (post-onboarding First Value phase). One hand-picked sample customer message
 * per vertical, chosen so it matches exactly one seeded internal_reply_rules row
 * (supabase/seed.sql) at that rule's own top trigger_priority -- deliberately avoiding any
 * keyword shared with another rule in the same vertical, so a fresh business (rules_only
 * automation_mode, the default for every business today) always produces a clean
 * AUTOMATE_REPLY, never a tie that falls through to Needs Owner Attention. Verified against
 * seed.sql's exact keyword arrays; tests/unit/demo/sample-messages.test.ts is the regression
 * guard if either file ever drifts from the other.
 *
 * This message is fed through the real lib/engine/automation.ts processInboundMessage()
 * pipeline (ADR pending -- First Value phase) -- there is no separate demo/simulation engine.
 */
export interface DemoSampleMessage {
  text: string;
}

export const DEMO_CUSTOMER_DISPLAY_NAME = "Priya (Sample Customer)";

/**
 * Fixed, deliberately-synthetic provider identity, scoped per business by
 * contact_channel_identities' own unique(business_id, channel_id, provider_user_id)
 * constraint -- resolveOrCreateContact() finds and reuses the same contact on every repeat
 * trigger rather than creating a new one each time, so repeated "Try Ordrfy" taps update one
 * sample contact instead of accumulating duplicates.
 */
export const DEMO_PROVIDER_USER_ID = "demo-sample-customer";

export const DEMO_CHANNEL: ChannelName = "whatsapp";

export const DEMO_SAMPLE_MESSAGES: Record<VerticalKey, DemoSampleMessage> = {
  fashion: { text: "Hi! Do you have this kurti in size M?" },
  tutor: { text: "Hi! What are your class timings?" },
  service: { text: "Hi! Are you available this Saturday?" },
  baker: { text: "Hi! What flavours do you have for a birthday cake?" },
  gift: { text: "Hi! Can you personalize this with a name on it?" },
};
