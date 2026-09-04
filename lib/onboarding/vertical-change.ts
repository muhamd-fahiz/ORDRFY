import type { VerticalKey } from "@/lib/design/verticals";

export type AttributeSelection = string[] | "not_sure";

export interface VerticalAnswers {
  attributesSelection: AttributeSelection;
  preferencesSelection: AttributeSelection;
  moreSubStep: 0 | 1 | 2;
  note: string;
}

/**
 * The state transformation applied whenever the detected/confirmed vertical actually
 * changes from a previously-set value (Phase 5 hardening). Every vertical-specific answer
 * collected on the "tell us more" step is tied to the OLD vertical's own attribute/
 * preference option lists (lib/onboarding/verticals/*.ts) and is meaningless -- and
 * untranslatable back to a label, see review-step.tsx's labelsFor() -- under a different
 * vertical, so it must be cleared, not carried over. The free-text note is vertical-
 * agnostic and is preserved exactly. Returns `current` unchanged (same reference) when
 * there is nothing to reset, so callers can apply the result unconditionally.
 */
export function applyVerticalChange(
  previousVertical: VerticalKey | null,
  nextVertical: VerticalKey,
  current: VerticalAnswers,
): VerticalAnswers {
  if (previousVertical === null || previousVertical === nextVertical) {
    return current;
  }
  return {
    attributesSelection: [],
    preferencesSelection: [],
    moreSubStep: 0,
    note: current.note,
  };
}
