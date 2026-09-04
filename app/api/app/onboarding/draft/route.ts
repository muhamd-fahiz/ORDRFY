import { NextResponse, type NextRequest } from "next/server";
import { createRlsClient } from "@/lib/db/server";
import { detectVertical } from "@/lib/onboarding/detect-vertical";
import { VERTICAL_KNOWLEDGE_BY_KEY } from "@/lib/onboarding/verticals";
import type { VerticalKey } from "@/lib/design/verticals";
import type { Database } from "@/lib/db/database.types";

type SignupDraftUpdate = Database["public"]["Tables"]["signup_drafts"]["Update"];

interface PatchBody {
  currentStep?: string;
  businessName?: string;
  city?: string;
  rawBusinessDescription?: string;
  /** Set only when the owner explicitly taps a vertical chip on the confirm step -- a real
   * human decision, unlike detectedVertical/verticalConfidence below, which this route
   * never accepts directly from the client (Phase 4 refinement 7). */
  confirmedVertical?: string;
  structuredAnswers?: Record<string, unknown>;
}

/**
 * Autosave for the onboarding wizard (ADR-0040/Phase 4). Uses the RLS client, not
 * service-role -- this is an ordinary per-user write signup_drafts' own RLS policy
 * (`user_id = auth.uid()`) already covers, unlike provisioning itself, which stays a
 * trusted-server-only action in lib/provisioning/provision-business.ts.
 *
 * Deliberately never accepts a client-supplied detected_vertical/vertical_confidence:
 * whenever the description changes, THIS route re-runs the same deterministic
 * detectVertical() the client already ran for instant feedback, and persists its own
 * result as the authoritative value. Since the function is pure, the two never actually
 * disagree -- this is a trust boundary (a client could otherwise just claim any vertical
 * without the description supporting it), not a second opinion.
 */
export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as PatchBody;
  const supabase = await createRlsClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const updates: SignupDraftUpdate = {};

  if (typeof body.currentStep === "string") updates.current_step = body.currentStep;
  if (typeof body.businessName === "string") updates.business_name = body.businessName;
  if (typeof body.city === "string") updates.city = body.city;

  if (typeof body.rawBusinessDescription === "string") {
    updates.raw_business_description = body.rawBusinessDescription;
    const detection = detectVertical(body.rawBusinessDescription);
    updates.detected_vertical = detection.vertical;
    updates.vertical_confidence = detection.status;
  }

  if (typeof body.confirmedVertical === "string") {
    if (!(body.confirmedVertical in VERTICAL_KNOWLEDGE_BY_KEY)) {
      return NextResponse.json({ error: "Unknown vertical." }, { status: 400 });
    }
    updates.detected_vertical = body.confirmedVertical as VerticalKey;
    updates.vertical_confidence = "confident";
  }

  if (body.structuredAnswers && typeof body.structuredAnswers === "object") {
    const { data: existing, error: readError } = await supabase
      .from("signup_drafts")
      .select("structured_answers")
      .eq("user_id", user.id)
      .eq("status", "in_progress")
      .maybeSingle();
    if (readError) {
      return NextResponse.json({ error: `Failed to read draft: ${readError.message}` }, { status: 500 });
    }
    updates.structured_answers = {
      ...((existing?.structured_answers as Record<string, unknown>) ?? {}),
      ...body.structuredAnswers,
    } as SignupDraftUpdate["structured_answers"];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true });
  }
  updates.updated_at = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("signup_drafts")
    .update(updates)
    .eq("user_id", user.id)
    .eq("status", "in_progress")
    .select("detected_vertical, vertical_confidence")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: `Failed to save draft: ${updateError.message}` }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "No active onboarding draft found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    detectedVertical: updated.detected_vertical,
    verticalConfidence: updated.vertical_confidence,
  });
}
