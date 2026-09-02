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
    <div className="flex max-w-xl flex-col gap-6 font-app">
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Settings</h1>
      <SettingsForm name={session.adminName} email={user?.email ?? ""} />
      <MfaSection />
    </div>
  );
}
