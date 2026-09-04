import type { VerticalKey } from "@/lib/design/verticals";

/**
 * The deterministic knowledge shape for one vertical (ADR-0041). Every field here is
 * static, hand-authored config -- no AI, no runtime computation -- read by
 * lib/onboarding/detect-vertical.ts for matching and (in a later phase) by the wizard UI
 * for its adaptive attribute/operating-preference chips. `vertical` is typed against the
 * existing VerticalKey from lib/design/verticals.ts, never a locally-declared type, so a
 * definition can never reference a vertical the rest of the product doesn't actually have.
 */
export interface VerticalKnowledgeDefinition {
  vertical: VerticalKey;

  /**
   * Canonical keywords/phrases that indicate this vertical when found in a business
   * description. A multi-word entry (e.g. "custom cake") is matched as a substring of the
   * normalized input; a single-word entry is matched against individual tokens, including
   * a small amount of typo tolerance (see lib/onboarding/text-similarity.ts).
   */
  keywords: string[];

  /**
   * Misspellings, plurals, or Hinglish/regional variants that are too different from any
   * keyword above for edit-distance matching to catch reliably, mapped to the canonical
   * keyword they stand in for. Matched with the same substring/token rules as keywords,
   * but weighted slightly lower (see AMBIGUITY_MARGIN/weights in detect-vertical.ts) since
   * an alias hit is a weaker signal than the business actually using the canonical term.
   */
  aliases: Record<string, string>;

  /** Suggested attribute chips for the wizard's adaptive screen (e.g. sizes, colours). Not consumed by this phase. */
  suggestedAttributes: { key: string; label: string }[];

  /** Suggested operating-preference chips (e.g. COD, delivery, appointments). Not consumed by this phase. */
  suggestedOperatingPreferences: { key: string; label: string }[];

  /** Suggested follow-up prompts the wizard may show, keyed for future reference. Not consumed by this phase. */
  followUpPrompts: { key: string; prompt: string }[];
}
