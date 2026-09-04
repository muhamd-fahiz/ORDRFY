"use server";

import { redirect } from "next/navigation";
import { requireReadyAdminSession } from "@/lib/auth/admin-guard";
import { provisionBusiness } from "@/lib/provisioning/provision-business";
import type { VerticalKey } from "@/lib/design/verticals";

export async function createBusiness(formData: FormData) {
  // Re-verify server-side even though the UI only shows this form to an already-gated
  // admin -- never trust that a request only reached here because the layout allowed it
  // (Ordrfy-Cost-Optimized-Stack.pdf Section 2: "strict server-side authorization, not
  // just relying on" the layer above).
  const session = await requireReadyAdminSession();

  const name = String(formData.get("name") ?? "").trim();
  const vertical = String(formData.get("vertical") ?? "");
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const timezone = String(formData.get("timezone") ?? "Asia/Kolkata");
  const preferredLanguage = String(formData.get("preferred_language") ?? "en");
  const subscriptionStatus = String(formData.get("subscription_status") ?? "trial") as
    | "trial"
    | "active"
    | "inactive";

  if (!name || !vertical) {
    throw new Error("Name and vertical are required.");
  }

  // Goes through the shared ProvisioningCore (ADR-0040), not a raw insert -- this is what
  // guarantees an admin-created business gets the same default business_settings/
  // business_entitlements a self-service business gets, closing a gap that predated this
  // phase (neither this action nor create-owner/route.ts ever wrote those tables before).
  // No owner membership and no knowledge profile are created here -- an admin-created
  // business has no owner yet (create-owner/route.ts adds one as a later, separate step,
  // unchanged) and no business_knowledge_profiles row until its owner completes the
  // "Complete your business profile" flow (Phase 2/4).
  const business = await provisionBusiness({
    source: "admin",
    name,
    vertical: vertical as VerticalKey,
    phone,
    email,
    timezone,
    preferredLanguage,
    subscriptionStatus,
    actorUserId: session.userId,
  });

  redirect(`/admin/businesses/${business.id}`);
}
