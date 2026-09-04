import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { VERTICAL_KNOWLEDGE_BY_KEY } from "@/lib/onboarding/verticals";
import type { VerticalKey } from "@/lib/design/verticals";

export type LabeledSelection = string[] | "not_sure" | null;

export interface BusinessKnowledgeProfile {
  summary: string;
  city: string | null;
  attributes: LabeledSelection;
  operatingPreferences: LabeledSelection;
  note: string | null;
}

function toLabeledSelection(raw: unknown, options: { key: string; label: string }[]): LabeledSelection {
  if (raw === "not_sure") return "not_sure";
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const byKey = new Map(options.map((option) => [option.key, option.label]));
  return raw.map((key) => (typeof key === "string" ? (byKey.get(key) ?? key) : String(key)));
}

/**
 * Reads the wizard's captured understanding of the business (business_knowledge_profiles),
 * relabeled from raw attribute/preference keys to the same display labels
 * app/onboarding/steps/review-step.tsx already uses -- this is the one other place that
 * knowledge is ever rendered, so the two must never drift into different wording for the
 * same key. Returns null for a business with no row yet (admin-created, wizard never
 * completed) -- absence is the signal, not an error; see the table's own migration comment.
 */
export async function getBusinessKnowledgeProfile(
  supabase: SupabaseClient<Database>,
  businessId: string,
): Promise<BusinessKnowledgeProfile | null> {
  const { data, error } = await supabase
    .from("business_knowledge_profiles")
    .select("summary, vertical, structured_answers")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load business knowledge profile: ${error.message}`);
  if (!data) return null;

  const definition = VERTICAL_KNOWLEDGE_BY_KEY[data.vertical as VerticalKey] as
    | (typeof VERTICAL_KNOWLEDGE_BY_KEY)[VerticalKey]
    | undefined;
  const structuredAnswers = (data.structured_answers ?? {}) as Record<string, unknown>;

  const city = typeof structuredAnswers.city === "string" && structuredAnswers.city.trim() ? structuredAnswers.city : null;
  const note = typeof structuredAnswers.note === "string" && structuredAnswers.note.trim() ? structuredAnswers.note : null;

  return {
    summary: data.summary,
    city,
    note,
    attributes: definition ? toLabeledSelection(structuredAnswers.attributes, definition.suggestedAttributes) : null,
    operatingPreferences: definition
      ? toLabeledSelection(structuredAnswers.operatingPreferences, definition.suggestedOperatingPreferences)
      : null,
  };
}
