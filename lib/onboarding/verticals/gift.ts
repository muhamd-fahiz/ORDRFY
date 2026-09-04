import type { VerticalKnowledgeDefinition } from "./types";

export const giftKnowledge: VerticalKnowledgeDefinition = {
  vertical: "gift",
  keywords: [
    "gift",
    "gifts",
    "personalized",
    "personalised",
    "custom gift",
    "surprise",
    "hamper",
    "hampers",
    "gift box",
    "gifting",
    "occasion",
    "anniversary gift",
    "birthday gift",
    "customised",
    "customized",
  ],
  aliases: {
    "giftt": "gift",
    "persnalized": "personalized",
    "surprize": "surprise",
    "hampr": "hamper",
  },
  suggestedAttributes: [
    { key: "personalization_options", label: "Personalization options" },
    { key: "occasions", label: "Occasions" },
  ],
  suggestedOperatingPreferences: [
    { key: "delivery_timing", label: "Delivery on a specific date" },
    { key: "advance_payment", label: "Advance payment" },
  ],
  followUpPrompts: [
    { key: "personalization_matters", prompt: "Can customers personalize what they order?" },
    { key: "occasion_matters", prompt: "Do most orders come in for a specific occasion?" },
  ],
};
