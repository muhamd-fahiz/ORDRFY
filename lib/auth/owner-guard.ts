import { redirect } from "next/navigation";
import { createRlsClient } from "@/lib/db/server";

export type OwnerSessionState =
  | { status: "signed_out" }
  | { status: "no_membership" }
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
 * V1 has exactly one membership per owner (role is 'owner'-only, and there is no self-serve
 * signup or team-invite flow yet) -- if that ever changes, this is the one place a business
 * switcher would need to be reintroduced.
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

  if (!membership || !membership.businesses) {
    return { status: "no_membership" };
  }

  return {
    status: "ready",
    userId: user.id,
    businessId: membership.business_id,
    businessName: membership.businesses.name,
    vertical: membership.businesses.vertical,
  };
}

/** For use in the protected layout: redirects away from anything but a fully-ready owner session. */
export async function requireReadyOwnerSession() {
  const state = await getOwnerSessionState();

  switch (state.status) {
    case "signed_out":
      redirect("/app/login");
    case "no_membership": {
      const supabase = await createRlsClient();
      await supabase.auth.signOut();
      redirect("/app/login?error=no_membership");
    }
    case "ready":
      return state;
  }
}
