"use client";

import type { VerticalKey } from "@/lib/design/verticals";

interface VerticalOption {
  key: VerticalKey;
  label: string;
}

interface VerticalConfirmStepProps {
  options: VerticalOption[];
  onSelect: (vertical: VerticalKey) => void;
  submitting: boolean;
}

/**
 * Shown only when the deterministic engine's result was "ambiguous" (a handful of close
 * candidates) or "unmatched" (all 5 real verticals, since there's nothing to narrow it
 * down by) -- both cases use the exact same warm framing, deliberately not distinguishing
 * "we're between two guesses" from "we couldn't tell" to the owner. Selecting an option
 * here is itself the confirmed answer -- one tap, no separate Continue button, matching
 * the single-tap feel of components/ui/PipelineStageStepper.tsx.
 */
export function VerticalConfirmStep({ options, onSelect, submitting }: VerticalConfirmStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1 font-data text-[11px] font-bold uppercase tracking-[0.1em] text-pink">Quick check</p>
        <h1 className="font-display text-xl font-bold text-ink">What best describes your business?</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            disabled={submitting}
            onClick={() => onSelect(option.key)}
            className="rounded-full bg-ink-15 px-4 py-2.5 font-app text-sm font-semibold text-ink-70 transition-colors hover:bg-ink-15/70 disabled:opacity-50"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
