import type { VerticalKnowledgeDefinition } from "./types";

export const bakerKnowledge: VerticalKnowledgeDefinition = {
  vertical: "baker",
  keywords: [
    "cake",
    "cakes",
    "bakery",
    "baker",
    "baking",
    "cupcake",
    "cupcakes",
    "pastry",
    "pastries",
    "dessert",
    "desserts",
    "birthday cake",
    "custom cake",
    "cookie",
    "cookies",
    "brownie",
    "brownies",
    "home bakery",
  ],
  aliases: {
    "keks": "cakes",
    "kek": "cake",
    "bakry": "bakery",
    "cak": "cake",
  },
  suggestedAttributes: [
    { key: "flavours", label: "Flavours" },
    { key: "custom_design", label: "Custom design" },
    { key: "advance_ordering", label: "Advance ordering" },
  ],
  suggestedOperatingPreferences: [
    { key: "delivery_or_pickup", label: "Delivery or pickup" },
    { key: "advance_payment", label: "Advance payment" },
  ],
  followUpPrompts: [
    { key: "flavours_matter", prompt: "Do customers usually choose a flavour?" },
    { key: "custom_design_matters", prompt: "Do you take custom design requests?" },
  ],
};
