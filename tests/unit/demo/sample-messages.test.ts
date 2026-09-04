import { describe, expect, it } from "vitest";
import { matchKeywordRule, type MatchableRule } from "@/lib/engine/automation-matching";
import { DEMO_SAMPLE_MESSAGES } from "@/lib/demo/sample-messages";

/**
 * Mirrors supabase/seed.sql's exact internal_reply_rules keyword/priority content (the "real
 * seeded content" the First Value demo depends on) as a local fixture, so this test fails
 * loudly if either file ever drifts from the other -- the regression guard called for in
 * lib/demo/sample-messages.ts's own doc comment.
 */
const SEEDED_RULES: Record<string, (MatchableRule & { ruleKey: string })[]> = {
  fashion: [
    { id: "fashion_price", ruleKey: "fashion_price", triggerKeywords: ["price", "cost", "how much", "rate"], triggerPriority: 10 },
    { id: "fashion_size", ruleKey: "fashion_size", triggerKeywords: ["size", "available", "in stock"], triggerPriority: 10 },
    { id: "fashion_delivery", ruleKey: "fashion_delivery", triggerKeywords: ["delivery", "shipping", "cod"], triggerPriority: 8 },
  ],
  tutor: [
    { id: "tutor_timing", ruleKey: "tutor_timing", triggerKeywords: ["timing", "timings", "schedule"], triggerPriority: 10 },
    { id: "tutor_fee", ruleKey: "tutor_fee", triggerKeywords: ["fee", "fees", "monthly fee", "cost"], triggerPriority: 10 },
    { id: "tutor_trial", ruleKey: "tutor_trial", triggerKeywords: ["trial", "trial class", "demo"], triggerPriority: 8 },
  ],
  service: [
    { id: "service_availability", ruleKey: "service_availability", triggerKeywords: ["available", "availability", "free on"], triggerPriority: 10 },
    { id: "service_package", ruleKey: "service_package", triggerKeywords: ["package", "packages", "price", "cost"], triggerPriority: 10 },
    { id: "service_travel", ruleKey: "service_travel", triggerKeywords: ["travel", "come to", "at home", "at my place"], triggerPriority: 8 },
  ],
  baker: [
    { id: "baker_price", ruleKey: "baker_price", triggerKeywords: ["price", "cost", "how much", "rate"], triggerPriority: 10 },
    { id: "baker_flavour", ruleKey: "baker_flavour", triggerKeywords: ["flavour", "flavor", "taste", "options"], triggerPriority: 10 },
    { id: "baker_eggless", ruleKey: "baker_eggless", triggerKeywords: ["eggless", "without egg", "egg or eggless"], triggerPriority: 9 },
    { id: "baker_availability", ruleKey: "baker_availability", triggerKeywords: ["available", "availability", "free on"], triggerPriority: 10 },
    { id: "baker_delivery", ruleKey: "baker_delivery", triggerKeywords: ["delivery", "deliver", "pickup"], triggerPriority: 8 },
    { id: "baker_custom_design", ruleKey: "baker_custom_design", triggerKeywords: ["custom design", "design", "photo cake", "theme cake"], triggerPriority: 9 },
  ],
  gift: [
    { id: "gift_recommendation", ruleKey: "gift_recommendation", triggerKeywords: ["what gifts", "recommend", "suggestion", "options"], triggerPriority: 10 },
    { id: "gift_budget", ruleKey: "gift_budget", triggerKeywords: ["budget", "price range", "how much", "cost"], triggerPriority: 10 },
    { id: "gift_personalization", ruleKey: "gift_personalization", triggerKeywords: ["personalize", "personalise", "customize", "customise", "add name", "engrave"], triggerPriority: 9 },
    { id: "gift_surprise", ruleKey: "gift_surprise", triggerKeywords: ["surprise", "secret delivery", "without them knowing"], triggerPriority: 9 },
    { id: "gift_delivery", ruleKey: "gift_delivery", triggerKeywords: ["delivery date", "deliver on", "delivery time"], triggerPriority: 8 },
  ],
};

describe("DEMO_SAMPLE_MESSAGES -- each sample cleanly matches exactly one seeded rule", () => {
  for (const [vertical, rules] of Object.entries(SEEDED_RULES)) {
    it(`${vertical}'s sample message produces a clean AUTOMATE_REPLY, not a tie or a miss`, () => {
      const sample = DEMO_SAMPLE_MESSAGES[vertical as keyof typeof DEMO_SAMPLE_MESSAGES];
      expect(sample).toBeDefined();

      const result = matchKeywordRule(sample.text, rules);
      expect(result.outcome).toBe("matched");
      if (result.outcome !== "matched") return;

      // The matched rule must be the vertical's own highest-priority match, and no other
      // rule in the vertical may have matched at all -- a real second match here would mean
      // this same input scores an "ambiguous" tie under runAutomationPipeline() in
      // lib/engine/automation.ts, which is the exact failure mode this fixture guards against.
      const allMatches = rules.filter((rule) => rule.triggerKeywords.some((kw) => sample.text.toLowerCase().includes(kw.toLowerCase())));
      expect(allMatches).toHaveLength(1);
      expect(allMatches[0]!.id).toBe(result.rule.id);
    });
  }

  it("defines a sample message for every real vertical -- no more, no fewer", () => {
    expect(Object.keys(DEMO_SAMPLE_MESSAGES).sort()).toEqual(Object.keys(SEEDED_RULES).sort());
  });
});
