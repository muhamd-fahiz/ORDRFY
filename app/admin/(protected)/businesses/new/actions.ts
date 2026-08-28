"use server";

import { redirect } from "next/navigation";
import { requireReadyAdminSession } from "@/lib/auth/admin-guard";
import { createServiceRoleClient } from "@/lib/db/server";

export async function createBusiness(formData: FormData) {
  // Re-verify server-side even though the UI only shows this form to an already-gated
  // admin -- never trust that a request only reached here because the layout allowed it
  // (Ordrfy-Cost-Optimized-Stack.pdf Section 2: "strict server-side authorization, not
  // just relying on" the layer above).
  await requireReadyAdminSession();

  const name = String(formData.get("name") ?? "").trim();
  const vertical = String(formData.get("vertical") ?? "");
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const timezone = String(formData.get("timezone") ?? "Asia/Kolkata");
  const preferredLanguage = String(formData.get("preferred_language") ?? "en");
  const subscriptionStatus = String(formData.get("subscription_status") ?? "trial");

  if (!name || !vertical) {
    throw new Error("Name and vertical are required.");
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("businesses")
    .insert({
      name,
      vertical,
      phone,
      email,
      timezone,
      preferred_language: preferredLanguage,
      subscription_status: subscriptionStatus,
      trial_ends_at:
        subscriptionStatus === "trial"
          ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
          : null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create business: ${error.message}`);
  }

  redirect(`/admin/businesses/${data.id}`);
}
