import type { VerticalKnowledgeDefinition } from "./types";

/**
 * "boutique" is deliberately also a keyword on service.ts (ADR-0041) -- it's the exact
 * worked ambiguous example this phase's own spec uses ("I run a boutique" could mean
 * clothing or a beauty/service boutique), and detect-vertical.ts is meant to surface that
 * as an ambiguous result, not silently pick one.
 */
export const fashionKnowledge: VerticalKnowledgeDefinition = {
  vertical: "fashion",
  keywords: [
    "clothing",
    "clothes",
    "cloth",
    "dress",
    "dresses",
    "kurti",
    "kurtis",
    "kurta",
    "kurtas",
    "saree",
    "sarees",
    "sari",
    "saris",
    "shirt",
    "shirts",
    "tshirt",
    "tshirts",
    "pant",
    "pants",
    "jeans",
    "boutique",
    "fashion",
    "apparel",
    "outfit",
    "outfits",
    "fabric",
    "tailoring",
    "tailor",
    "abaya",
    "lehenga",
    "ladies wear",
    "western wear",
    "ethnic wear",
  ],
  aliases: {
    "kurthi": "kurti",
    "kurthis": "kurti",
    "kurthee": "kurti",
    "t-shirt": "tshirt",
    "cloths": "clothes",
  },
  suggestedAttributes: [
    { key: "sizes", label: "Sizes" },
    { key: "colours", label: "Colours" },
    { key: "custom_orders", label: "Custom orders" },
    { key: "delivery", label: "Delivery" },
  ],
  suggestedOperatingPreferences: [
    { key: "cod", label: "Cash on delivery" },
    { key: "advance_payment", label: "Advance payment" },
    { key: "shipping", label: "Ships outside the city" },
  ],
  followUpPrompts: [
    { key: "sizes_matter", prompt: "Do your products come in different sizes?" },
    { key: "colours_matter", prompt: "Do customers usually pick a colour?" },
  ],
};
