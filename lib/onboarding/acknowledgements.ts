import type { VerticalKey } from "@/lib/design/verticals";

/**
 * The wizard's one deterministic "we heard you" line (ADR-0041/Phase 4), shown once the
 * vertical is settled -- confidently detected, or explicitly confirmed by the owner on the
 * disambiguation step. Deliberately just a static per-vertical phrase, not a template that
 * reasons about the free-text description itself -- it must never imply the system
 * understood more than "which of our 5 known business types this is."
 */
const ACKNOWLEDGEMENT_PHRASE_BY_VERTICAL: Record<VerticalKey, string> = {
  fashion: "sounds like you run a fashion business",
  baker: "sounds like you run a home bakery",
  tutor: "sounds like you run a tutoring business",
  service: "sounds like you run a service business",
  gift: "sounds like you're in personalized gifts",
};

export function getAcknowledgement(vertical: VerticalKey): string {
  return `Got it — ${ACKNOWLEDGEMENT_PHRASE_BY_VERTICAL[vertical]}.`;
}
