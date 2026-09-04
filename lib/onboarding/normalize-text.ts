/**
 * Deterministic normalization for realistic customer/owner free-text input (ADR-0041):
 * lowercased, accents stripped, punctuation replaced with spaces (so "AC-repair!!" and
 * "ac repair" normalize identically), whitespace collapsed. Applied identically to both
 * the business description and every keyword/alias being matched against it, so a
 * hand-written keyword list never has to anticipate every punctuation variant itself.
 */
export function normalizeText(input: string): string {
  const withoutAccents = input.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "");
  return withoutAccents.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/** Normalized, whitespace-separated tokens -- empty array for empty/whitespace-only input. */
export function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  return normalized.length > 0 ? normalized.split(" ") : [];
}
