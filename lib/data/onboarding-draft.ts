import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { VerticalKey } from "@/lib/design/verticals";

export interface OnboardingDraft {
  id: string;
  currentStep: string | null;
  businessName: string | null;
  city: string | null;
  rawBusinessDescription: string | null;
  detectedVertical: VerticalKey | null;
  verticalConfidence: "confident" | "ambiguous" | "unmatched" | null;
  structuredAnswers: Record<string, unknown>;
}

const DRAFT_COLUMNS =
  "id, current_step, business_name, city, raw_business_description, detected_vertical, vertical_confidence, structured_answers";

interface DraftRow {
  id: string;
  current_step: string | null;
  business_name: string | null;
  city: string | null;
  raw_business_description: string | null;
  detected_vertical: string | null;
  vertical_confidence: string | null;
  structured_answers: unknown;
}

function toOnboardingDraft(row: DraftRow): OnboardingDraft {
  return {
    id: row.id,
    currentStep: row.current_step,
    businessName: row.business_name,
    city: row.city,
    rawBusinessDescription: row.raw_business_description,
    detectedVertical: (row.detected_vertical as VerticalKey | null) ?? null,
    verticalConfidence: (row.vertical_confidence as OnboardingDraft["verticalConfidence"]) ?? null,
    structuredAnswers: (row.structured_answers as Record<string, unknown>) ?? {},
  };
}

/**
 * Reads through an RLS-scoped client -- the "one active draft per user" invariant is
 * enforced by signup_drafts' own partial unique index (ADR-0040), so at most one
 * in_progress row can ever exist for this user; this either finds it or creates it.
 * Called from app/onboarding/page.tsx on every visit to the onboarding route, which is
 * exactly the point: a fresh signup with no draft yet gets one created on first entry, and
 * a returning owner mid-onboarding gets their existing progress back, with no separate
 * "start onboarding" action required.
 */
export async function getOrCreateActiveDraft(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<OnboardingDraft> {
  const { data: existing, error: selectError } = await supabase
    .from("signup_drafts")
    .select(DRAFT_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .maybeSingle();
  if (selectError) throw new Error(`Failed to load onboarding draft: ${selectError.message}`);
  if (existing) return toOnboardingDraft(existing);

  const { data: created, error: insertError } = await supabase
    .from("signup_drafts")
    .insert({ user_id: userId })
    .select(DRAFT_COLUMNS)
    .single();

  if (insertError) {
    // Race (Phase 5 hardening, found live): the SELECT above and this INSERT are not
    // atomic, so a concurrent call for the same user -- two tabs, or the confirmed-email
    // page's redirect firing more than once -- can both see "no active draft" and both
    // attempt to create one. signup_drafts' own partial unique index
    // (idx_signup_drafts_one_active_per_user) correctly rejects the loser with Postgres
    // error 23505 (unique_violation); the fix is to re-select and return the winner's row,
    // not to surface this as a real failure.
    if (insertError.code === "23505") {
      const { data: afterRace, error: reselectError } = await supabase
        .from("signup_drafts")
        .select(DRAFT_COLUMNS)
        .eq("user_id", userId)
        .eq("status", "in_progress")
        .single();
      if (reselectError) {
        throw new Error(`Failed to load onboarding draft after a concurrent create: ${reselectError.message}`);
      }
      return toOnboardingDraft(afterRace);
    }
    throw new Error(`Failed to create onboarding draft: ${insertError.message}`);
  }

  return toOnboardingDraft(created);
}
