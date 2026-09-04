import { redirect } from "next/navigation";
import { createRlsClient } from "@/lib/db/server";
import { getOwnerSessionState } from "@/lib/auth/owner-guard";
import { ordrfyFontVariables } from "@/lib/design/fonts";

/**
 * Guard for the onboarding route (ADR-0040/Phase 4, hardened Phase 5). Anything but a
 * signed-in, non-admin user with no completed business gets redirected away -- an
 * already-provisioned owner (`ready`) is never shown the wizard again, a signed-out
 * visitor goes to login. "no_membership_no_draft" and "no_membership_has_draft" are both
 * allowed through: page.tsx itself creates the draft on first entry via
 * getOrCreateActiveDraft() (ADR-0040), so there is no separate "start onboarding" step to
 * gate on here. "no_membership_admin_account" must be explicitly blocked here too, not
 * just at the login route -- an admin who is already authenticated could otherwise
 * navigate to /onboarding directly and start a stray business under their own identity.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const state = await getOwnerSessionState();

  switch (state.status) {
    case "signed_out":
      redirect("/app/login");
    case "ready":
      redirect("/app/today");
    case "no_membership_admin_account": {
      const supabase = await createRlsClient();
      await supabase.auth.signOut();
      redirect("/app/login?error=no_membership");
    }
    case "no_membership_no_draft":
    case "no_membership_has_draft":
      break;
  }

  return <div className={`${ordrfyFontVariables} min-h-screen bg-paper font-app text-ink`}>{children}</div>;
}
