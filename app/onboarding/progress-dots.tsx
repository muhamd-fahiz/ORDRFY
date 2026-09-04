/**
 * Deliberately dots, not "Step X of Y" text (locked requirement 8) -- the sr-only label
 * gives screen readers the same wayfinding a numeric label would, without it being the
 * visible signal. total/current are computed by the wizard from the ACTUAL step sequence
 * for this session (the disambiguation step is only counted when it's actually shown), so
 * this never promises a step that won't appear.
 */
export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="mb-5 flex items-center gap-1.5">
      <span className="sr-only" aria-live="polite">{`Step ${current + 1} of ${total}`}</span>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`h-1.5 rounded-full transition-all ${index === current ? "w-5 bg-pink-strong" : "w-1.5 bg-ink-15"}`}
        />
      ))}
    </div>
  );
}
