import { redirect } from "next/navigation";
import { createRlsClient } from "@/lib/db/server";
import { getOrCreateActiveDraft } from "@/lib/data/onboarding-draft";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const supabase = await createRlsClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Re-verified here even though the layout above already redirects signed-out sessions --
  // never trust that a request only reached here because the layer above allowed it (same
  // discipline as app/admin/(protected)/businesses/new/actions.ts's own re-check).
  if (!user) redirect("/app/login");

  const draft = await getOrCreateActiveDraft(supabase, user.id);

  return (
    // The "stage" -- how wide the wizard is allowed to get. Mobile is untouched (max-w-sm,
    // same as before this pass). At tablet+ this only sets an upper bound; it deliberately
    // does not by itself make every screen wider -- see identity-step.tsx/description-
    // step.tsx/vertical-confirm-step.tsx, which cap themselves narrower than this stage
    // even when there's more room, since a single-line input or a paragraph-width textarea
    // doesn't get more usable by stretching. tell-us-more-step.tsx and review-step.tsx have
    // no such inner cap, so they're the ones that actually use the extra width this
    // provides (more chips per row, a review card with real breathing room).
    <div className="mx-auto max-w-sm px-4 py-6 sm:max-w-xl sm:px-6 sm:py-10 lg:max-w-2xl lg:py-14">
      <OnboardingWizard draft={draft} />
    </div>
  );
}
