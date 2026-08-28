/**
 * Pure keyword-matching logic (Ordrfy-Final-Architecture.pdf Section 3d / V1-Master-Plan
 * Section 3d): no DB access here either, same reasoning as channel-selection.ts. The DB
 * fetch (which rules exist for this business/vertical/language) lives in automation.ts;
 * this file only decides, given a message and a candidate rule set, which rule wins.
 */

export interface MatchableRule {
  id: string;
  triggerKeywords: string[];
  triggerPriority: number;
}

export type MatchResult =
  | { outcome: "matched"; rule: MatchableRule }
  | { outcome: "no_match" }
  | { outcome: "ambiguous"; tiedRules: MatchableRule[] };

/**
 * Multiple keywords per rule, case-insensitive substring match. If more than one rule
 * matches, the highest trigger_priority wins. If the top priority is tied across more than
 * one matching rule, that's ambiguous -- never guessed, always falls through to Needs Owner
 * Attention (a silent wrong guess is worse than one extra flagged message).
 */
export function matchKeywordRule(messageContent: string, candidateRules: MatchableRule[]): MatchResult {
  const normalized = messageContent.toLowerCase();

  const matched = candidateRules.filter((rule) =>
    rule.triggerKeywords.some((keyword) => normalized.includes(keyword.toLowerCase())),
  );

  if (matched.length === 0) {
    return { outcome: "no_match" };
  }

  const topPriority = Math.max(...matched.map((r) => r.triggerPriority));
  const topMatches = matched.filter((r) => r.triggerPriority === topPriority);

  if (topMatches.length > 1) {
    return { outcome: "ambiguous", tiedRules: topMatches };
  }

  return { outcome: "matched", rule: topMatches[0]! };
}

export interface MatchableOptOutKeyword {
  keyword: string;
}

/** Opt-out detection always runs before rule matching and always wins over it (India-fit addendum #11). */
export function matchesOptOutKeyword(messageContent: string, keywords: MatchableOptOutKeyword[]): boolean {
  const normalized = messageContent.toLowerCase();
  return keywords.some((k) => normalized.includes(k.keyword.toLowerCase()));
}
