import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Client = SupabaseClient<Database>;

/**
 * businesses.automation_paused means exactly one thing -- admin-toggled -- and nothing
 * else (Non-Negotiable Architecture Rule 7). Checked as the final gate before ANY outbound
 * send, in the shared engine, before handoff to any channel adapter -- so it applies
 * identically across every enabled channel with no per-channel special-casing, and must be
 * tested against multi-channel businesses, not just one channel.
 */
export async function isAutomationPaused(supabase: Client, businessId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("businesses")
    .select("automation_paused")
    .eq("id", businessId)
    .single();
  if (error) throw new Error(`Failed to read kill switch state: ${error.message}`);
  return data.automation_paused;
}

/**
 * Every toggle is logged with the admin's identity and timestamp (Ordrfy-Hardening-
 * Addendum.pdf Section 4). Only ever called from an authenticated, MFA-verified admin
 * route -- this function itself does not re-check that, callers must.
 */
export async function setAutomationPaused(
  supabase: Client,
  businessId: string,
  paused: boolean,
  actorUserId: string,
): Promise<void> {
  const { error } = await supabase.from("businesses").update({ automation_paused: paused }).eq("id", businessId);
  if (error) throw new Error(`Failed to update kill switch: ${error.message}`);

  await supabase.from("activity_log").insert({
    business_id: businessId,
    event_type: paused ? "automation_paused" : "automation_resumed",
    actor_user_id: actorUserId,
  });
}
