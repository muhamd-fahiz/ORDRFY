import { requireReadyAdminSession } from "@/lib/auth/admin-guard";
import { createRlsClient } from "@/lib/db/server";
import { SettingsForm } from "./settings-form";
import { MfaSection } from "./mfa-section";

export default async function AdminSettingsPage() {
  const session = await requireReadyAdminSession();
  const supabase = await createRlsClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex max-w-2xl flex-col gap-8 font-app lg:gap-10">
      <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl lg:text-5xl">Settings</h1>
      <SettingsForm name={session.adminName} email={user?.email ?? ""} />
      <MfaSection />
    </div>
  );
}
