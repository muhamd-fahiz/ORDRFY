import { describe, expect, it } from "vitest";
import { applyVerticalChange, type VerticalAnswers } from "@/lib/onboarding/vertical-change";

describe("applyVerticalChange", () => {
  it("clears vertical-specific attributes/preferences and resets moreSubStep, but preserves the note, when the vertical actually changes", () => {
    const fashionAnswers: VerticalAnswers = {
      attributesSelection: ["sizes", "colours"],
      preferencesSelection: ["cod"],
      moreSubStep: 2,
      note: "We also do custom orders",
    };

    const result = applyVerticalChange("fashion", "baker", fashionAnswers);

    expect(result).toEqual<VerticalAnswers>({
      attributesSelection: [],
      preferencesSelection: [],
      moreSubStep: 0,
      note: "We also do custom orders",
    });
  });

  it("preserves 'not_sure' being cleared the same as an array selection", () => {
    const answers: VerticalAnswers = {
      attributesSelection: "not_sure",
      preferencesSelection: "not_sure",
      moreSubStep: 1,
      note: "",
    };

    const result = applyVerticalChange("tutor", "service", answers);

    expect(result.attributesSelection).toEqual([]);
    expect(result.preferencesSelection).toEqual([]);
    expect(result.moreSubStep).toBe(0);
  });

  it("returns the answers unchanged (same reference) when there is no previous vertical yet", () => {
    const answers: VerticalAnswers = { attributesSelection: [], preferencesSelection: [], moreSubStep: 0, note: "" };
    const result = applyVerticalChange(null, "fashion", answers);
    expect(result).toBe(answers);
  });

  it("returns the answers unchanged (same reference) when the vertical is confirmed as the same one", () => {
    const answers: VerticalAnswers = {
      attributesSelection: ["sizes"],
      preferencesSelection: ["cod"],
      moreSubStep: 1,
      note: "Ships nationwide",
    };
    const result = applyVerticalChange("fashion", "fashion", answers);
    expect(result).toBe(answers);
  });
});
