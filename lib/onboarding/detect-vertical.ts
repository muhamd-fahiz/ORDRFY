import type { VerticalKey } from "@/lib/design/verticals";
import { normalizeText } from "./normalize-text";
import { isCloseMatch } from "./text-similarity";
import { VERTICAL_KNOWLEDGE_DEFINITIONS } from "./verticals";

export type VerticalDetectionStatus = "confident" | "ambiguous" | "unmatched";

export interface VerticalMatch {
  vertical: VerticalKey;
  score: number;
  /** Canonical keywords that contributed to this score -- useful for debugging/tests, not consumed by this phase. */
  matchedKeywords: string[];
}

export interface VerticalDetectionResult {
  status: VerticalDetectionStatus;
  /** The single best match when status is "confident"; null otherwise -- never a guess when ambiguous or unmatched. */
  vertical: VerticalKey | null;
  /**
   * Every vertical that scored above zero, sorted by score descending. Always populated,
   * even when status is "confident" (candidates[0].vertical === vertical) -- a caller can
   * always inspect the full picture instead of only trusting a collapsed single winner
   * (this phase's own principle: multiple matches stay visible, never silently collapsed).
   */
  candidates: VerticalMatch[];
}

const EXACT_KEYWORD_WEIGHT = 2;
const ALIAS_OR_TYPO_WEIGHT = 1;

/**
 * Two verticals within this many points of the top score are treated as a genuine tie for
 * "ambiguous" rather than one confidently winning -- e.g. "boutique" alone scores exactly
 * EXACT_KEYWORD_WEIGHT on both fashion and service, a 0-point gap, which must always
 * surface as ambiguous. A gap of AMBIGUITY_MARGIN or less is still close enough to not
 * force a single winner; a gap larger than that is treated as confident.
 */
const AMBIGUITY_MARGIN = 1;

function isMultiWord(text: string): boolean {
  return text.includes(" ");
}

/**
 * Scores one vertical's multi-word keywords/aliases (substring match against the whole
 * normalized input) into `score`/`matchedKeywords`. Kept separate from the single-word
 * pass below: a phrase like "custom cake" is specific enough that near-duplicate phrase
 * entries are rare in practice, unlike single words.
 */
function scorePhrases(
  entries: [phrase: string, canonicalKeyword: string, weight: number][],
  normalizedInput: string,
  matchedKeywords: Set<string>,
): number {
  let score = 0;
  for (const [phrase, canonicalKeyword, weight] of entries) {
    if (matchedKeywords.has(canonicalKeyword)) continue;
    if (normalizedInput.includes(normalizeText(phrase))) {
      score += weight;
      matchedKeywords.add(canonicalKeyword);
    }
  }
  return score;
}

/**
 * Scores one vertical's single-word keywords/aliases token-by-token. Each distinct input
 * token contributes AT MOST ONCE to this vertical's score, regardless of how many
 * near-duplicate keywords it happens to resemble -- e.g. the token "kurti" must not
 * separately score against the keywords "kurti", "kurtis", AND "kurta" just because a
 * fuzzy match technically succeeds against all three. Priority per token: exact keyword >
 * fuzzy keyword > exact alias > fuzzy alias.
 */
function scoreSingleWordTokens(
  keywords: string[],
  aliases: [aliasText: string, canonicalKeyword: string][],
  uniqueInputTokens: string[],
  matchedKeywords: Set<string>,
): number {
  const normalizedKeywords = keywords.map((keyword) => ({ keyword, normalized: normalizeText(keyword) }));
  const normalizedAliases = aliases.map(([aliasText, canonicalKeyword]) => ({
    canonicalKeyword,
    normalized: normalizeText(aliasText),
  }));

  let score = 0;

  for (const token of uniqueInputTokens) {
    const exactKeyword = normalizedKeywords.find(({ normalized }) => normalized === token);
    if (exactKeyword) {
      score += EXACT_KEYWORD_WEIGHT;
      matchedKeywords.add(exactKeyword.keyword);
      continue;
    }

    const fuzzyKeyword = normalizedKeywords.find(({ normalized }) => isCloseMatch(token, normalized));
    if (fuzzyKeyword) {
      score += EXACT_KEYWORD_WEIGHT;
      matchedKeywords.add(fuzzyKeyword.keyword);
      continue;
    }

    const exactAlias = normalizedAliases.find(({ normalized }) => normalized === token);
    if (exactAlias && !matchedKeywords.has(exactAlias.canonicalKeyword)) {
      score += ALIAS_OR_TYPO_WEIGHT;
      matchedKeywords.add(exactAlias.canonicalKeyword);
      continue;
    }

    const fuzzyAlias = normalizedAliases.find(({ normalized }) => isCloseMatch(token, normalized));
    if (fuzzyAlias && !matchedKeywords.has(fuzzyAlias.canonicalKeyword)) {
      score += ALIAS_OR_TYPO_WEIGHT;
      matchedKeywords.add(fuzzyAlias.canonicalKeyword);
    }
  }

  return score;
}

/**
 * Deterministic, AI-free vertical detection (ADR-0041). Scores every known vertical
 * against the input's normalized text and tokens, using exact/typo-tolerant keyword
 * matches and alias matches, and returns the full ranked picture rather than only a single
 * winner -- callers (the future wizard) decide what to do with "ambiguous"/"unmatched",
 * this function never forces a vertical it isn't confident about.
 */
export function detectVertical(rawInput: string): VerticalDetectionResult {
  const normalizedInput = normalizeText(rawInput);
  const inputTokens = normalizedInput.length > 0 ? normalizedInput.split(" ") : [];
  const uniqueInputTokens = Array.from(new Set(inputTokens));

  const matches: VerticalMatch[] = [];

  for (const definition of VERTICAL_KNOWLEDGE_DEFINITIONS) {
    const matchedKeywords = new Set<string>();

    const phraseKeywords = definition.keywords
      .filter(isMultiWord)
      .map((keyword): [string, string, number] => [keyword, keyword, EXACT_KEYWORD_WEIGHT]);
    const phraseAliases = Object.entries(definition.aliases)
      .filter(([aliasText]) => isMultiWord(aliasText))
      .map(([aliasText, canonicalKeyword]): [string, string, number] => [aliasText, canonicalKeyword, ALIAS_OR_TYPO_WEIGHT]);

    const singleWordKeywords = definition.keywords.filter((keyword) => !isMultiWord(keyword));
    const singleWordAliases = Object.entries(definition.aliases).filter(([aliasText]) => !isMultiWord(aliasText));

    const phraseScore = scorePhrases([...phraseKeywords, ...phraseAliases], normalizedInput, matchedKeywords);
    const tokenScore = scoreSingleWordTokens(singleWordKeywords, singleWordAliases, uniqueInputTokens, matchedKeywords);
    const score = phraseScore + tokenScore;

    if (score > 0) {
      matches.push({ vertical: definition.vertical, score, matchedKeywords: Array.from(matchedKeywords) });
    }
  }

  matches.sort((a, b) => b.score - a.score);

  const top = matches[0];
  if (!top) {
    return { status: "unmatched", vertical: null, candidates: [] };
  }

  const closeCandidates = matches.filter((match) => match.score >= top.score - AMBIGUITY_MARGIN);

  if (closeCandidates.length > 1) {
    return { status: "ambiguous", vertical: null, candidates: closeCandidates };
  }

  return { status: "confident", vertical: top.vertical, candidates: [top] };
}
