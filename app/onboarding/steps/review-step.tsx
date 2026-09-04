"use client";

import { Button } from "@/components/ui/Button";
import type { AttributeSelection } from "./tell-us-more-step";

interface AttributeOption {
  key: string;
  label: string;
}

interface ReviewStepProps {
  businessName: string;
  city: string;
  verticalLabel: string;
  description: string;
  attributeOptions: AttributeOption[];
  preferenceOptions: AttributeOption[];
  attributesSelection: AttributeSelection;
  preferencesSelection: AttributeSelection;
  note: string;
  onEditIdentity: () => void;
  onEditDescription: () => void;
  onEditMore: () => void;
  onFinish: () => void;
  submitting: boolean;
  error: string | null;
}

function labelsFor(selection: AttributeSelection, options: AttributeOption[]): string | null {
  if (selection === "not_sure") return "Not sure yet";
  if (!Array.isArray(selection) || selection.length === 0) return null;
  const byKey = new Map(options.map((option) => [option.key, option.label]));
  return selection.map((key) => byKey.get(key) ?? key).join(", ");
}

/**
 * The final review (locked refinement 2): a completion moment, not a settings printout.
 * Always renders from the wizard's live state, never a frozen snapshot -- an Edit tap just
 * changes the outer step, so returning here always reflects whatever was actually changed.
 */
export function ReviewStep({
  businessName,
  city,
  verticalLabel,
  description,
  attributeOptions,
  preferenceOptions,
  attributesSelection,
  preferencesSelection,
  note,
  onEditIdentity,
  onEditDescription,
  onEditMore,
  onFinish,
  submitting,
  error,
}: ReviewStepProps) {
  const attributesSummary = labelsFor(attributesSelection, attributeOptions);
  const preferencesSummary = labelsFor(preferencesSelection, preferenceOptions);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1 font-data text-[11px] font-bold uppercase tracking-[0.1em] text-pink">You&apos;re all set</p>
        <h1 className="font-display text-xl font-bold text-ink">Here&apos;s what we understood about your business.</h1>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-ink-15 bg-paper-raised p-4">
        <section className="flex items-start justify-between gap-3">
          <div>
            <p className="font-app text-xs font-semibold uppercase tracking-wide text-ink-40">Business</p>
            <p className="font-app text-sm text-ink">
              {businessName} -- {city}
            </p>
          </div>
          {/* -m-2/p-2 grows the actual tap target (this project's spacing scale: 16px each
              side, so +32px on both axes) while cancelling out visually -- the "Edit" text
              stays exactly where it was, only its invisible hit area is bigger. */}
          <button
            type="button"
            onClick={onEditIdentity}
            className="-m-2 p-2 font-app text-xs text-pink-strong underline-offset-2 hover:underline"
          >
            Edit
          </button>
        </section>

        <section className="flex items-start justify-between gap-3">
          <div>
            <p className="font-app text-xs font-semibold uppercase tracking-wide text-ink-40">Type of business</p>
            <p className="font-app text-sm text-ink">{verticalLabel}</p>
            <p className="mt-1 font-app text-sm text-ink-70">{description}</p>
          </div>
          <button
            type="button"
            onClick={onEditDescription}
            className="-m-2 p-2 font-app text-xs text-pink-strong underline-offset-2 hover:underline"
          >
            Edit
          </button>
        </section>

        {(attributesSummary || preferencesSummary || note) && (
          <section className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              {attributesSummary && (
                <p className="font-app text-sm text-ink">
                  <span className="text-ink-40">Customers usually ask about: </span>
                  {attributesSummary}
                </p>
              )}
              {preferencesSummary && (
                <p className="font-app text-sm text-ink">
                  <span className="text-ink-40">How you operate: </span>
                  {preferencesSummary}
                </p>
              )}
              {note && (
                <p className="font-app text-sm text-ink">
                  <span className="text-ink-40">Also: </span>
                  {note}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onEditMore}
              className="-m-2 p-2 font-app text-xs text-pink-strong underline-offset-2 hover:underline"
            >
              Edit
            </button>
          </section>
        )}
      </div>

      <p className="font-app text-xs text-ink-40">You can change or add to this anytime.</p>

      {error && <p className="font-app text-sm text-attention">{error}</p>}

      <Button onClick={onFinish} disabled={submitting} className="mt-1">
        {submitting ? "Setting up your business..." : "Looks good -- Finish setup"}
      </Button>
    </div>
  );
}
