import { describe, expect, it } from "vitest";
import { detectVertical } from "@/lib/onboarding/detect-vertical";
import { VERTICAL_KNOWLEDGE_DEFINITIONS } from "@/lib/onboarding/verticals";
import { VERTICAL_META } from "@/lib/design/verticals";

describe("detectVertical -- clear matches", () => {
  it("confidently identifies a fashion business", () => {
    const result = detectVertical("I sell kurtis, sarees and dresses through Instagram");
    expect(result.status).toBe("confident");
    expect(result.vertical).toBe("fashion");
    expect(result.candidates).toHaveLength(1);
  });

  it("confidently identifies a baker business", () => {
    const result = detectVertical("I run a home bakery, mostly custom birthday cakes and cupcakes");
    expect(result.status).toBe("confident");
    expect(result.vertical).toBe("baker");
  });

  it("confidently identifies a tutor business", () => {
    const result = detectVertical("I teach maths and science tuition for school students");
    expect(result.status).toBe("confident");
    expect(result.vertical).toBe("tutor");
  });

  it("confidently identifies a service business", () => {
    const result = detectVertical("I do AC repair and electrician work, appointment only");
    expect(result.status).toBe("confident");
    expect(result.vertical).toBe("service");
  });

  it("confidently identifies a gift business", () => {
    const result = detectVertical("I make personalized gift hampers for birthdays and anniversaries");
    expect(result.status).toBe("confident");
    expect(result.vertical).toBe("gift");
  });
});

describe("detectVertical -- ambiguous matches", () => {
  it("never silently guesses between fashion and service for a bare 'boutique'", () => {
    const result = detectVertical("I run a boutique");
    expect(result.status).toBe("ambiguous");
    expect(result.vertical).toBeNull();
    const candidateVerticals = result.candidates.map((c) => c.vertical).sort();
    expect(candidateVerticals).toEqual(["fashion", "service"]);
  });

  it("keeps every close-scoring vertical visible, not collapsed to one winner", () => {
    const result = detectVertical("I run a boutique");
    expect(result.candidates.length).toBeGreaterThan(1);
    for (const candidate of result.candidates) {
      expect(candidate.score).toBeGreaterThan(0);
    }
  });
});

describe("detectVertical -- no match / generic fallback", () => {
  it("returns an unmatched result rather than forcing a vertical", () => {
    const result = detectVertical("asdkfj random text nothing relevant here whatsoever");
    expect(result.status).toBe("unmatched");
    expect(result.vertical).toBeNull();
    expect(result.candidates).toEqual([]);
  });

  it("treats empty input the same way", () => {
    const result = detectVertical("");
    expect(result.status).toBe("unmatched");
    expect(result.vertical).toBeNull();
  });
});

describe("detectVertical -- messy casing, punctuation, and spelling", () => {
  it("normalizes casing and punctuation before matching", () => {
    const result = detectVertical("I SELL Shirts!!! For Men & Boys... WhatsApp only!!");
    expect(result.status).toBe("confident");
    expect(result.vertical).toBe("fashion");
  });

  it("tolerates a plausible typo of a keyword", () => {
    // "dres" is a one-character-short typo of "dress" -- close enough to count, per
    // lib/onboarding/text-similarity.ts's length-scaled tolerance.
    const result = detectVertical("I sell ladies dres and other clothes");
    expect(result.status).toBe("confident");
    expect(result.vertical).toBe("fashion");
  });

  it("resolves a known alias too different from its keyword for edit-distance alone", () => {
    // "kurthee" is registered as an alias for "kurti" on fashion.ts and is deliberately
    // far enough from every real fashion keyword (including "kurti" itself) that fuzzy
    // matching alone would miss it -- only the explicit alias entry catches it.
    const result = detectVertical("I sell kurthee and dres");
    expect(result.status).toBe("confident");
    expect(result.vertical).toBe("fashion");
    expect(result.candidates[0]?.matchedKeywords).toContain("kurti");
  });

  it("does not fuzzy-match a short keyword into a false positive", () => {
    // "cap" must never be treated as a typo of "cake" -- both are short, unrelated words.
    const result = detectVertical("I sell caps");
    expect(result.status).toBe("unmatched");
  });
});

describe("detectVertical -- mixed/overlapping business descriptions", () => {
  it("surfaces both verticals as ambiguous when a description genuinely spans two", () => {
    const result = detectVertical("I sell custom cakes and also do kurti tailoring");
    expect(result.status).toBe("ambiguous");
    expect(result.vertical).toBeNull();
    const candidateVerticals = result.candidates.map((c) => c.vertical).sort();
    expect(candidateVerticals).toEqual(["baker", "fashion"]);
  });

  it("still lets one vertical win confidently when it clearly dominates a mixed description", () => {
    const result = detectVertical(
      "I sell kurtis, sarees, dresses and western wear -- occasionally also do a custom gift box for regular customers",
    );
    expect(result.status).toBe("confident");
    expect(result.vertical).toBe("fashion");
  });
});

describe("VerticalKey compatibility", () => {
  it("defines knowledge for exactly the existing VerticalKey values -- no more, no fewer", () => {
    const definedKeys = VERTICAL_KNOWLEDGE_DEFINITIONS.map((definition) => definition.vertical).sort();
    const expectedKeys = Object.keys(VERTICAL_META).sort();
    expect(definedKeys).toEqual(expectedKeys);
  });

  it("gives every vertical a unique knowledge definition", () => {
    const definedKeys = VERTICAL_KNOWLEDGE_DEFINITIONS.map((definition) => definition.vertical);
    expect(new Set(definedKeys).size).toBe(definedKeys.length);
  });
});
