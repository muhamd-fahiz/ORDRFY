"use client";

import { Button } from "@/components/ui/Button";

interface IdentityStepProps {
  businessName: string;
  city: string;
  onChangeBusinessName: (value: string) => void;
  onChangeCity: (value: string) => void;
  onContinue: () => void;
  submitting: boolean;
}

export function IdentityStep({
  businessName,
  city,
  onChangeBusinessName,
  onChangeCity,
  onContinue,
  submitting,
}: IdentityStepProps) {
  const canContinue = businessName.trim().length > 0 && city.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1 font-data text-[11px] font-bold uppercase tracking-[0.1em] text-pink">Let&apos;s set up your business</p>
        <h1 className="font-display text-xl font-bold text-ink">About 2 minutes -- let&apos;s start with the basics.</h1>
      </div>

      <label className="flex flex-col gap-1 font-app text-sm text-ink-70">
        Business name
        <input
          value={businessName}
          onChange={(e) => onChangeBusinessName(e.target.value)}
          placeholder="e.g. Fahiz Fashion"
          className="rounded-lg border border-ink-15 bg-paper-raised px-3 py-2 font-app text-ink"
        />
      </label>

      <label className="flex flex-col gap-1 font-app text-sm text-ink-70">
        City
        <input
          value={city}
          onChange={(e) => onChangeCity(e.target.value)}
          placeholder="e.g. Kochi"
          className="rounded-lg border border-ink-15 bg-paper-raised px-3 py-2 font-app text-ink"
        />
      </label>

      <Button onClick={onContinue} disabled={!canContinue || submitting} className="mt-2">
        {submitting ? "Saving..." : "Continue"}
      </Button>
    </div>
  );
}
