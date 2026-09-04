import { NextResponse } from "next/server";
import { createRlsClient } from "@/lib/db/server";
import { provisionBusiness } from "@/lib/provisioning/provision-business";

/**
 * The explicit provisioning boundary (ADR-0040/Phase 4): nothing is written to
 * businesses/business_memberships/business_settings/business_entitlements/
 * business_knowledge_profiles until this route runs, and it only runs when the owner taps
 * "Looks good -- Finish setup" on the review screen.
 *
 * The caller's own active draft is resolved here via the RLS client (auth.uid()) --
 * never a client-supplied draft id -- so this route can only ever provision a business
 * from the signed-in user's own draft, matching the "no client-side privileged
 * provisioning" boundary Phase 1 established for the admin path. provisionBusiness()
 * itself then uses the service-role client to actually write the records, exactly as
 * app/admin/(protected)/businesses/new/actions.ts already does for the assisted path --
 * one shared ProvisioningCore, not two.
 */
export async function POST() {
  const supabase = await createRlsClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: draft, error: draftError } = await supabase
    .from("signup_drafts")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "in_progress")
    .maybeSingle();
  if (draftError) {
    return NextResponse.json({ error: `Failed to load draft: ${draftError.message}` }, { status: 500 });
  }
  if (!draft) {
    return NextResponse.json({ error: "No active onboarding draft found." }, { status: 404 });
  }

  try {
    const business = await provisionBusiness({ source: "self_service", draftId: draft.id });
    return NextResponse.json({ ok: true, businessId: business.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to finish setup.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
