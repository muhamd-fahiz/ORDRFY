type CopyrightTone = "on-ink" | "on-paper";

const TONE_CLASS: Record<CopyrightTone, string> = {
  "on-ink": "text-paper/35",
  "on-paper": "text-ink-40",
};

/** One line, reused everywhere a copyright notice belongs -- the year is computed, never hardcoded. */
export function Copyright({ tone = "on-paper" }: { tone?: CopyrightTone }) {
  const year = new Date().getFullYear();
  return <p className={`font-data text-[11px] tracking-[0.04em] ${TONE_CLASS[tone]}`}>&copy; {year} Ordrfy. All rights reserved.</p>;
}
