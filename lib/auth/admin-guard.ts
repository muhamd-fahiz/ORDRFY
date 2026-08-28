import { redirect } from "next/navigation";
import { createRlsClient } from "@/lib/db/server";

export type AdminSessionState =
  | { status: "signed_out" }
  | { status: "not_admin" }
  | { status: "needs_mfa_enrollment"; userId: string }
  | { status: "needs_mfa_challenge"; userId: string }
  | { status: "ready"; userId: string; adminName: string };

/**
 * The single source of truth for "is this request allowed into the admin panel." Used by
 * the protected layout (redirects on anything but "ready") and by the login/MFA screens
 * (to avoid re-showing a step the session has already passed, or to bounce a signed-in
 * non-admin straight back out).
 *
 * Admin panel routes verify admin_users membership via this RLS-scoped check (the
 * `users_see_own_admin_row` policy lets a user read only their own row), THEN -- once
 * past this guard -- use the service-role client for actual cross-tenant business data.
 * The service-role key itself is never involved in the auth decision (Ordrfy-Final-
 * Architecture.pdf Section 4).
 */
export async function getAdminSessionState(): Promise<AdminSessionState> {
  const supabase = await createRlsClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "signed_out" };
  }

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("name, mfa_required")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) {
    return { status: "not_admin" };
  }

  if (adminRow.mfa_required) {
    const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) {
      throw new Error(`Could not determine MFA assurance level: ${error.message}`);
    }

    if (aal.nextLevel !== "aal2") {
      return { status: "needs_mfa_enrollment", userId: user.id };
    }
    if (aal.currentLevel !== aal.nextLevel) {
      return { status: "needs_mfa_challenge", userId: user.id };
    }
  }

  return { status: "ready", userId: user.id, adminName: adminRow.name };
}

/** For use in the protected layout: redirects away from anything but a fully-ready admin session. */
export async function requireReadyAdminSession() {
  const state = await getAdminSessionState();

  switch (state.status) {
    case "signed_out":
      redirect("/admin/login");
    case "not_admin": {
      const supabase = await createRlsClient();
      await supabase.auth.signOut();
      redirect("/admin/login?error=not_admin");
    }
    case "needs_mfa_enrollment":
      redirect("/admin/mfa/enroll");
    case "needs_mfa_challenge":
      redirect("/admin/mfa/challenge");
    case "ready":
      return state;
  }
}
