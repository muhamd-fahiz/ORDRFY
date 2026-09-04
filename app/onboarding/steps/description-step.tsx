"use client";

import { Button } from "@/components/ui/Button";

interface DescriptionStepProps {
  description: string;
  onChangeDescription: (value: string) => void;
  onContinue: () => void;
  submitting: boolean;
  saveState: "idle" | "saving" | "saved";
}

export function DescriptionStep({ description, onChangeDescription, onContinue, submitting, saveState }: DescriptionStepProps) {
  const canContinue = description.trim().length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1 font-data text-[11px] font-bold uppercase tracking-[0.1em] text-pink">The important part</p>
        <h1 className="font-display text-xl font-bold text-ink">What do you sell or do?</h1>
        <p className="mt-1.5 font-app text-sm text-ink-70">
          Write it just like you&apos;d explain your business to a friend. Don&apos;t worry about spelling or grammar.
        </p>
      </div>

      <textarea
        value={description}
        onChange={(e) => onChangeDescription(e.target.value)}
        placeholder="e.g. I sell kurtis and dresses through Instagram"
        rows={5}
        className="rounded-lg border border-ink-15 bg-paper-raised px-3 py-2 font-app text-ink"
      />

      <div className="flex h-4 items-center">
        {saveState === "saving" && <span className="font-app text-xs text-ink-40">Saving...</span>}
        {saveState === "saved" && <span className="font-app text-xs text-confirmed">Saved</span>}
      </div>

      <Button onClick={onContinue} disabled={!canContinue || submitting} className="mt-1">
        {submitting ? "Just a moment..." : "Continue"}
      </Button>
    </div>
  );
}
