import type { VerticalKey } from "@/lib/design/verticals";
import type { VerticalKnowledgeDefinition } from "./types";
import { fashionKnowledge } from "./fashion";
import { bakerKnowledge } from "./baker";
import { tutorKnowledge } from "./tutor";
import { serviceKnowledge } from "./service";
import { giftKnowledge } from "./gift";

export type { VerticalKnowledgeDefinition } from "./types";

/**
 * Adding a 6th vertical's knowledge later (ADR-0041) means: add a row to the verticals
 * table (already the established pattern, ADR-0009), write one new file in this
 * directory, and add it to this array -- detect-vertical.ts iterates this list generically
 * and never special-cases a specific vertical, so no other file needs to change.
 */
export const VERTICAL_KNOWLEDGE_DEFINITIONS: VerticalKnowledgeDefinition[] = [
  fashionKnowledge,
  bakerKnowledge,
  tutorKnowledge,
  serviceKnowledge,
  giftKnowledge,
];

export const VERTICAL_KNOWLEDGE_BY_KEY: Record<VerticalKey, VerticalKnowledgeDefinition> = {
  fashion: fashionKnowledge,
  baker: bakerKnowledge,
  tutor: tutorKnowledge,
  service: serviceKnowledge,
  gift: giftKnowledge,
};
