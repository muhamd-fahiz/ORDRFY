import { NextResponse, type NextRequest } from "next/server";
import { getOwnerSessionState } from "@/lib/auth/owner-guard";
import { createRlsClient } from "@/lib/db/server";

/**
 * "Review" on the Today view: a single tap that clears every unresolved
 * owner_attention_queue row for one contact. V1 has no in-app reply composer, so the real
 * work (reading the message, replying on WhatsApp) always happens outside Ordrfy -- this
 * action's honest job is "I looked at this, take it off my list," not "here's what I did
 * about it." It deliberately does not move pipeline_stage_id: inferring the right stage
 * from message content would be exactly the NLP-driven auto-reply logic CLAUDE.md's "what
 * NOT to build in V1" list excludes.
 *
 * Runs entirely through createRlsClient() -- both the UPDATE and the activity_log insert
 * rely on owner_attention_queue/activity_log's tenant-isolation RLS policies (business_id
 * in (select business_id from business_memberships where user_id = auth.uid())), the same
 * policies already proven against cross-tenant reads. The explicit .eq("business_id", ...)
 * below is belt-and-suspenders, not the actual boundary -- RLS is.
 */
export async function POST(request: NextRequest) {
  const state = await getOwnerSessionState();
  if (state.status !== "ready") {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { contactId } = (await request.json()) as { contactId?: string };
  if (!contactId) {
    return NextResponse.json({ error: "contactId is required." }, { status: 400 });
  }

  const supabase = await createRlsClient();

  const { data: resolvedRows, error } = await supabase
    .from("owner_attention_queue")
    .update({ resolved_at: new Date().toISOString(), resolved_by: state.userId })
    .eq("business_id", state.businessId)
    .eq("contact_id", contactId)
    .is("resolved_at", null)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (resolvedRows.length > 0) {
    await supabase.from("activity_log").insert({
      business_id: state.businessId,
      contact_id: contactId,
      event_type: "attention_resolved",
      event_detail: { resolved_ids: resolvedRows.map((r) => r.id) },
      actor_user_id: state.userId,
    });
  }

  return NextResponse.json({ ok: true, resolvedCount: resolvedRows.length });
}
