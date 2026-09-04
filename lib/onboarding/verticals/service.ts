import type { VerticalKnowledgeDefinition } from "./types";

/**
 * "boutique" is deliberately also a keyword on fashion.ts -- see that file's comment. A
 * beauty/salon boutique is the reading this vertical covers.
 */
export const serviceKnowledge: VerticalKnowledgeDefinition = {
  vertical: "service",
  keywords: [
    "service",
    "services",
    "repair",
    "repairs",
    "electrician",
    "plumber",
    "plumbing",
    "salon",
    "beauty",
    "spa",
    "appointment",
    "appointments",
    "booking",
    "technician",
    "electrical",
    "cleaning",
    "maintenance",
    "boutique",
    "ac repair",
    "home service",
  ],
  aliases: {
    "electrican": "electrician",
    "electrican services": "electrician",
    "salloon": "salon",
    "plumer": "plumber",
    "repiar": "repair",
  },
  suggestedAttributes: [
    { key: "service_area", label: "Service area" },
    { key: "service_types", label: "Service types" },
  ],
  suggestedOperatingPreferences: [
    { key: "appointments", label: "Appointment booking" },
    { key: "working_hours", label: "Fixed working hours" },
  ],
  followUpPrompts: [
    { key: "appointment_needed", prompt: "Do customers usually need to book an appointment?" },
    { key: "service_area_matters", prompt: "Do you serve a specific area only?" },
  ],
};
