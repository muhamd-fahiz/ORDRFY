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
    <div className="mx-auto max-w-sm px-4 py-6">
      <OnboardingWizard draft={draft} />
    </div>
  );
}
