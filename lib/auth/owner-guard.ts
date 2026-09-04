import { redirect } from "next/navigation";
import { createRlsClient } from "@/lib/db/server";

export type OwnerSessionState =
  | { status: "signed_out" }
  | { status: "no_membership_no_draft" }
  | { status: "no_membership_admin_account" }
  | { status: "no_membership_has_draft"; draftId: string }
  | { status: "ready"; userId: string; businessId: string; businessName: string; vertical: string };

/**
 * The single source of truth for "is this request allowed into the owner app." Mirrors
 * lib/auth/admin-guard.ts's shape, but there is no MFA branch here -- a deliberate choice,
 * not an oversight: an owner session is scoped by RLS to exactly one business
 * (business_memberships + auth.uid(), Non-Negotiable Architecture Rule 3), unlike an admin
 * session, which reaches every tenant's data via the service-role client. The daily-use
 * priority for this surface (CLAUDE.md: "fast and low-friction... single-tap actions") also
 * argues against adding a step here that admin's higher-privilege surface justifies.
 *
 * "no_membership" (ADR-0017's original shape) is now three states (ADR-0040, Phase 5
 * hardening). The original single state conflated two populations that need opposite
 * treatment: a legitimate account with nothing yet -- a fresh self-service signup, or a
 * returning owner whose draft expired after 14 days (expire_stale_signup_drafts()) -- is
 * eligible to start/resume onboarding; an admin account with no owner membership (e.g. an
 * admin who signed into this form by mistake) must never be routed there, regardless of
 * draft state, since that could nudge them into creating a stray business under their own
 * identity. The distinction is a positive identity check against admin_users -- the same
 * table and RLS policy (`users_see_own_admin_row`) lib/auth/admin-guard.ts already trusts
 * -- not a heuristic, and it is checked before the draft lookup so it takes priority.
 *
 * V1 has exactly one membership per owner (role is 'owner'-only) -- if that ever changes,
 * this is the one place a business switcher would need to be reintroduced.
 */
export async function getOwnerSessionState(): Promise<OwnerSessionState> {
  const supabase = await createRlsClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "signed_out" };
  }

  const { data: membership } = await supabase
    .from("business_memberships")
    .select("business_id, businesses(name, vertical)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membership && membership.businesses) {
    return {
      status: "ready",
      userId: user.id,
      businessId: membership.business_id,
      businessName: membership.businesses.name,
      vertical: membership.businesses.vertical,
    };
  }

  const { data: adminRow } = await supabase.from("admin_users").select("id").eq("user_id", user.id).maybeSingle();

  if (adminRow) {
    return { status: "no_membership_admin_account" };
  }

  const { data: draft } = await supabase
    .from("signup_drafts")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "in_progress")
    .maybeSingle();

  if (draft) {
    return { status: "no_membership_has_draft", draftId: draft.id };
  }

  return { status: "no_membership_no_draft" };
}

/** For use in the protected layout: redirects away from anything but a fully-ready owner session. */
export async function requireReadyOwnerSession() {
  const state = await getOwnerSessionState();

  switch (state.status) {
    case "signed_out":
      redirect("/app/login");
    case "no_membership_has_draft":
    case "no_membership_no_draft":
      redirect("/onboarding");
    case "no_membership_admin_account": {
      const supabase = await createRlsClient();
      await supabase.auth.signOut();
      redirect("/app/login?error=no_membership");
    }
    case "ready":
      return state;
  }
}
