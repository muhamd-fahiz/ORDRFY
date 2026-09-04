/**
 * Hand-rolled Levenshtein distance (ADR-0041) -- no dependency added. Matching a short
 * free-text answer against a few dozen static keywords per vertical is small enough that a
 * plain O(n*m) dynamic-programming table is more than fast enough; a fuzzy-search library
 * or a Postgres extension (pg_trgm is not enabled in this project) would be more machinery
 * than this problem needs.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previousRow: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);

  for (let i = 1; i <= a.length; i++) {
    const currentRow: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      const deletion = (previousRow[j] ?? 0) + 1;
      const insertion = (currentRow[j - 1] ?? 0) + 1;
      const substitution = (previousRow[j - 1] ?? 0) + substitutionCost;
      currentRow.push(Math.min(deletion, insertion, substitution));
    }
    previousRow = currentRow;
  }

  return previousRow[b.length] ?? Math.max(a.length, b.length);
}

/**
 * How much typo tolerance a keyword of a given length is worth. Deliberately conservative
 * -- a short word (<=4 chars) must match exactly (fuzzy-matching e.g. "cat"/"cap" would
 * cause more false positives than the typo tolerance is worth), and even longer words only
 * get 1-2 characters of slack.
 */
function maxEditDistanceFor(keywordLength: number): number {
  if (keywordLength <= 4) return 0;
  if (keywordLength <= 6) return 1;
  return 2;
}

/**
 * Whether `token` is close enough to `keyword` to count as a typo of it, not a different
 * word. Requires the same first character -- found necessary in practice: without it,
 * ordinary English words that happen to share a long suffix with a keyword (e.g.
 * "nothing" vs "clothing", both ending in "othing") were being fuzzy-matched as typos.
 * Real typos essentially never change the first letter, so this rules out that whole class
 * of accidental collision without giving up genuine typo tolerance.
 */
export function isCloseMatch(token: string, keyword: string): boolean {
  const allowedDistance = maxEditDistanceFor(keyword.length);
  if (allowedDistance === 0) return token === keyword;
  if (token.length === 0 || keyword.length === 0) return false;
  if (token[0] !== keyword[0]) return false;
  if (Math.abs(token.length - keyword.length) > allowedDistance) return false;
  return levenshteinDistance(token, keyword) <= allowedDistance;
}
