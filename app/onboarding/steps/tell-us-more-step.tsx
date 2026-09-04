"use client";

import { Button } from "@/components/ui/Button";
import { ChoiceChip } from "../choice-chip";
import type { AttributeSelection } from "@/lib/onboarding/vertical-change";

export type { AttributeSelection };

interface AttributeOption {
  key: string;
  label: string;
}

interface TellUsMoreStepProps {
  acknowledgement: string;
  subStep: 0 | 1 | 2;
  attributeOptions: AttributeOption[];
  preferenceOptions: AttributeOption[];
  attributesSelection: AttributeSelection;
  preferencesSelection: AttributeSelection;
  note: string;
  onToggleAttribute: (key: string) => void;
  onToggleAttributeNotSure: () => void;
  onTogglePreference: (key: string) => void;
  onTogglePreferenceNotSure: () => void;
  onChangeNote: (value: string) => void;
  onContinue: () => void;
  onSkipWholeStep: () => void;
  submitting: boolean;
}

/**
 * Step 4, "tell us more" (locked refinement 1): a small progressive sequence -- at most one
 * question visible at a time, never two chip groups shown together -- rather than one big
 * settings form. subStep 0 is attributes, 1 is operating preferences, 2 is the one optional
 * note; the outer wizard advances subStep on Continue. Every screen offers "Skip for now",
 * jumping straight to Review -- nothing here is required to finish setup.
 */
export function TellUsMoreStep({
  acknowledgement,
  subStep,
  attributeOptions,
  preferenceOptions,
  attributesSelection,
  preferencesSelection,
  note,
  onToggleAttribute,
  onToggleAttributeNotSure,
  onTogglePreference,
  onTogglePreferenceNotSure,
  onChangeNote,
  onContinue,
  onSkipWholeStep,
  submitting,
}: TellUsMoreStepProps) {
  return (
    <div className="flex flex-col gap-4">
      {subStep === 0 && (
        <div>
          <p className="mb-1 font-data text-[11px] font-bold uppercase tracking-[0.1em] text-pink">Help us understand your business a little better</p>
          <h1 className="font-display text-lg font-bold text-ink">{acknowledgement}</h1>
        </div>
      )}

      {subStep === 0 && (
        <div className="flex flex-col gap-2.5">
          <p className="font-app text-sm font-semibold text-ink">What do customers usually ask about?</p>
          <div className="flex flex-wrap gap-2">
            {attributeOptions.map((option) => (
              <ChoiceChip
                key={option.key}
                label={option.label}
                selected={Array.isArray(attributesSelection) && attributesSelection.includes(option.key)}
                onToggle={() => onToggleAttribute(option.key)}
              />
            ))}
            <ChoiceChip label="Not sure yet" selected={attributesSelection === "not_sure"} onToggle={onToggleAttributeNotSure} />
          </div>
        </div>
      )}

      {subStep === 1 && (
        <div className="flex flex-col gap-2.5">
          <p className="font-app text-sm font-semibold text-ink">How do you usually like to operate?</p>
          <div className="flex flex-wrap gap-2">
            {preferenceOptions.map((option) => (
              <ChoiceChip
                key={option.key}
                label={option.label}
                selected={Array.isArray(preferencesSelection) && preferencesSelection.includes(option.key)}
                onToggle={() => onTogglePreference(option.key)}
              />
            ))}
            <ChoiceChip label="Not sure yet" selected={preferencesSelection === "not_sure"} onToggle={onTogglePreferenceNotSure} />
          </div>
        </div>
      )}

      {subStep === 2 && (
        <label className="flex flex-col gap-1 font-app text-sm text-ink-70">
          Anything else you&apos;d like to add? (optional)
          <input
            value={note}
            onChange={(e) => onChangeNote(e.target.value)}
            placeholder="e.g. mostly ships within Kerala"
            className="rounded-lg border border-ink-15 bg-paper-raised px-3 py-2 font-app text-ink"
          />
        </label>
      )}

      <div className="mt-1 flex flex-col gap-2">
        <Button onClick={onContinue} disabled={submitting}>
          {submitting ? "Saving..." : subStep === 2 ? "Continue to review" : "Continue"}
        </Button>
        <button
          type="button"
          onClick={onSkipWholeStep}
          disabled={submitting}
          className="font-app text-xs text-ink-40 underline-offset-2 hover:underline disabled:opacity-50"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
