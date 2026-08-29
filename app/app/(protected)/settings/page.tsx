import { requireReadyOwnerSession } from "@/lib/auth/owner-guard";
import { createRlsClient } from "@/lib/db/server";
import { getBusinessProfile } from "@/lib/data/business-profile";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const session = await requireReadyOwnerSession();
  const supabase = await createRlsClient();
  const profile = await getBusinessProfile(supabase, session.businessId);

  return (
    <div className="mx-auto max-w-sm px-4 py-6">
      <h1 className="mb-6 font-display text-xl font-bold text-ink">Settings</h1>
      <SettingsForm profile={profile} />
    </div>
  );
}
