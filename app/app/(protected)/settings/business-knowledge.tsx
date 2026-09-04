import { Chip } from "@/components/ui/Chip";
import type { BusinessKnowledgeProfile, LabeledSelection } from "@/lib/data/business-knowledge";

function SelectionChips({ selection }: { selection: LabeledSelection }) {
  if (selection === "not_sure") return <p className="font-app text-sm text-ink-70">Not sure yet</p>;
  if (!selection) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {selection.map((label) => (
        <Chip key={label}>{label}</Chip>
      ))}
    </div>
  );
}

/**
 * Read-only display of what the onboarding wizard captured (business_knowledge_profiles) --
 * the same underlying data app/onboarding/steps/review-step.tsx showed once, at the end of
 * setup, now reachable again afterward. Deliberately has no edit action: no field here has a
 * real save path yet, and offering one would be a UI promising a capability that doesn't
 * exist (see settings-form.tsx's own scoped-to-real-fields precedent).
 */
export function BusinessKnowledge({ profile }: { profile: BusinessKnowledgeProfile | null }) {
  if (!profile) {
    return (
      <section className="mb-6">
        <h2 className="mb-2 font-app text-xs font-semibold uppercase tracking-wide text-ink-40">
          What Ordrfy understands about your business
        </h2>
        <p className="font-app text-sm text-ink-70">
          Nothing captured yet -- this is filled in during setup.
        </p>
      </section>
    );
  }

  const hasAttributes = profile.attributes !== null;
  const hasPreferences = profile.operatingPreferences !== null;

  return (
    <section className="mb-6">
      <h2 className="mb-2 font-app text-xs font-semibold uppercase tracking-wide text-ink-40">
        What Ordrfy understands about your business
      </h2>
      <div className="flex flex-col gap-3 rounded-2xl border border-ink-15 bg-paper-raised p-4">
        <div>
          <p className="font-app text-xs font-semibold uppercase tracking-wide text-ink-40">In your own words</p>
          <p className="mt-1 font-app text-sm text-ink">{profile.summary}</p>
        </div>

        {profile.city && (
          <div>
            <p className="font-app text-xs font-semibold uppercase tracking-wide text-ink-40">City</p>
            <p className="mt-1 font-app text-sm text-ink">{profile.city}</p>
          </div>
        )}

        {hasAttributes && (
          <div>
            <p className="font-app text-xs font-semibold uppercase tracking-wide text-ink-40">
              Customers usually ask about
            </p>
            <div className="mt-1">
              <SelectionChips selection={profile.attributes} />
            </div>
          </div>
        )}

        {hasPreferences && (
          <div>
            <p className="font-app text-xs font-semibold uppercase tracking-wide text-ink-40">How you operate</p>
            <div className="mt-1">
              <SelectionChips selection={profile.operatingPreferences} />
            </div>
          </div>
        )}

        {profile.note && (
          <div>
            <p className="font-app text-xs font-semibold uppercase tracking-wide text-ink-40">Also</p>
            <p className="mt-1 font-app text-sm text-ink">{profile.note}</p>
          </div>
        )}
      </div>
      <p className="mt-2 font-app text-xs text-ink-40">Captured when you set up your business. Read-only for now.</p>
    </section>
  );
}
