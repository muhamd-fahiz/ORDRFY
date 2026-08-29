import { NextResponse, type NextRequest } from "next/server";
import { getOwnerSessionState } from "@/lib/auth/owner-guard";
import { createRlsClient } from "@/lib/db/server";

/**
 * Moving a contact's pipeline stage is a single tap on the contact-detail screen's stage
 * stepper -- no form, matching the standing "one tap for routine, repeated actions"
 * principle (ADR-0006's Notes). The UPDATE itself runs through the RLS-scoped client, same
 * as the Today view's mutations (ADR-0019): contacts' tenant-isolation policy is what
 * actually allows or blocks this write, not the .eq("business_id", ...) filter below, which
 * is belt-and-suspenders. guard_contact_pipeline_stage (the DB trigger) is the second,
 * independent layer -- it would reject a cross-tenant/cross-vertical stageId even if this
 * route had a bug that let one through.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const state = await getOwnerSessionState();
  if (state.status !== "ready") {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id: contactId } = await params;
  const { stageId } = (await request.json()) as { stageId?: string };
  if (!stageId) {
    return NextResponse.json({ error: "stageId is required." }, { status: 400 });
  }

  const supabase = await createRlsClient();

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, pipeline_stage_id")
    .eq("id", contactId)
    .eq("business_id", state.businessId)
    .maybeSingle();
  if (contactError) {
    return NextResponse.json({ error: contactError.message }, { status: 500 });
  }
  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  const previousStageId = contact.pipeline_stage_id;

  const { error: updateError } = await supabase
    .from("contacts")
    .update({ pipeline_stage_id: stageId })
    .eq("id", contactId)
    .eq("business_id", state.businessId);
  if (updateError) {
    // Covers guard_contact_pipeline_stage rejecting a stage that doesn't belong to this
    // business/vertical -- shouldn't happen via the UI (the stepper only ever offers valid
    // stages), but the trigger is the real guarantee, not the UI's own filtering.
    return NextResponse.json({ error: `Could not change stage: ${updateError.message}` }, { status: 400 });
  }

  await supabase.from("activity_log").insert({
    business_id: state.businessId,
    contact_id: contactId,
    event_type: "pipeline_stage_changed",
    event_detail: { from_stage_id: previousStageId, to_stage_id: stageId },
    actor_user_id: state.userId,
  });

  return NextResponse.json({ ok: true });
}
