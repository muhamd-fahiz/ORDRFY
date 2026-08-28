import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Client = SupabaseClient<Database>;

/**
 * Business-specific override first, else the vertical default, lowest sort_order --
 * same fallback pattern as every other business_id-nullable config table
 * (Ordrfy-Final-Architecture.pdf Section 3).
 */
export async function getInitialPipelineStage(
  supabase: Client,
  businessId: string,
  vertical: string,
): Promise<string> {
  const { data: businessSpecific } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("business_id", businessId)
    .eq("vertical", vertical)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (businessSpecific) return businessSpecific.id;

  const { data: verticalDefault, error } = await supabase
    .from("pipeline_stages")
    .select("id")
    .is("business_id", null)
    .eq("vertical", vertical)
    .order("sort_order", { ascending: true })
    .limit(1)
    .single();
  if (error) throw new Error(`No default pipeline stage seeded for vertical ${vertical}: ${error.message}`);

  return verticalDefault.id;
}

/**
 * The pipeline_stage_guard_trigger (20260828120018) already enforces cross-tenant/
 * cross-vertical validity at the database level -- this function just adds the audit
 * trail on top, it isn't itself a safety mechanism.
 */
export async function moveContactToStage(
  supabase: Client,
  contactId: string,
  businessId: string,
  stageId: string,
  actorUserId?: string,
): Promise<void> {
  const { error } = await supabase
    .from("contacts")
    .update({ pipeline_stage_id: stageId, updated_at: new Date().toISOString() })
    .eq("id", contactId);
  if (error) throw new Error(`Failed to move contact to stage: ${error.message}`);

  await supabase.from("activity_log").insert({
    business_id: businessId,
    contact_id: contactId,
    event_type: "stage_changed",
    event_detail: { stage_id: stageId },
    actor_user_id: actorUserId ?? null,
  });
}
