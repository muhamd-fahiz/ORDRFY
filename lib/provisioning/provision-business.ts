import { createServiceRoleClient } from "@/lib/db/server";
import type { VerticalKey } from "@/lib/design/verticals";

/**
 * The single call site both the admin-assisted and self-service onboarding paths use to
 * create a business (ADR-0040). Neither path is allowed a second, parallel way to write
 * businesses/business_memberships/business_settings/business_entitlements -- this module
 * exists specifically so that can never happen. Both branches below ultimately call the
 * same provision_business() Postgres function
 * (20260904000003_provisioning_core_functions.sql); the two input shapes differ only
 * because the two callers genuinely have different things on hand (an admin's fresh form
 * fields vs. an already-collected signup_drafts row), not because the underlying
 * provisioning logic differs.
 *
 * Always uses the service-role client -- provisioning must happen server-side only, never
 * via a client-side privileged write. Authorization (is this admin session real, does this
 * draft actually belong to the calling user) is the caller's responsibility, checked before
 * this function is invoked -- mirroring how app/api/admin/businesses/[id]/create-owner/
 * route.ts checks the admin session before its own service-role writes.
 */
export type ProvisionBusinessInput =
  | {
      source: "admin";
      name: string;
      vertical: VerticalKey;
      phone?: string | null;
      email?: string | null;
      timezone?: string;
      preferredLanguage?: string;
      subscriptionStatus?: "trial" | "active" | "inactive";
      actorUserId: string;
    }
  | {
      source: "self_service";
      draftId: string;
    };

export interface ProvisionedBusiness {
  id: string;
  name: string;
  vertical: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
}

function toProvisionedBusiness(row: {
  id: string;
  name: string;
  vertical: string;
  subscription_status: string;
  trial_ends_at: string | null;
}): ProvisionedBusiness {
  return {
    id: row.id,
    name: row.name,
    vertical: row.vertical,
    subscriptionStatus: row.subscription_status,
    trialEndsAt: row.trial_ends_at,
  };
}

export async function provisionBusiness(input: ProvisionBusinessInput): Promise<ProvisionedBusiness> {
  const supabase = createServiceRoleClient();

  if (input.source === "self_service") {
    const { data, error } = await supabase.rpc("finish_onboarding", { p_draft_id: input.draftId });
    if (error) throw new Error(`Failed to finish onboarding: ${error.message}`);
    return toProvisionedBusiness(data);
  }

  const { data, error } = await supabase.rpc("provision_business", {
    p_name: input.name,
    p_vertical: input.vertical,
    p_phone: input.phone ?? undefined,
    p_email: input.email ?? undefined,
    p_timezone: input.timezone ?? "Asia/Kolkata",
    p_preferred_language: input.preferredLanguage ?? "en",
    p_subscription_status: input.subscriptionStatus ?? "trial",
    p_actor_user_id: input.actorUserId,
    p_source: "admin",
  });
  if (error) throw new Error(`Failed to provision business: ${error.message}`);
  return toProvisionedBusiness(data);
}
