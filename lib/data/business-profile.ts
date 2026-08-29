import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

export interface BusinessProfile {
  name: string;
  phone: string | null;
  email: string | null;
  timezone: string;
  preferredLanguage: string;
}

/**
 * The owner-editable subset of `businesses` -- name/phone/email/timezone/preferred_language.
 * Deliberately excludes `vertical` (admin-controlled identity field with cascading
 * pipeline_stages/template implications -- an "admin vertical reassignment" event per
 * activity_log's own comment, not a self-service owner edit) and `subscription_status`/
 * `automation_paused` (admin/billing-controlled, never owner-editable).
 */
export async function getBusinessProfile(supabase: SupabaseClient<Database>, businessId: string): Promise<BusinessProfile> {
  const { data, error } = await supabase
    .from("businesses")
    .select("name, phone, email, timezone, preferred_language")
    .eq("id", businessId)
    .single();
  if (error) throw new Error(`Failed to load business profile: ${error.message}`);

  return {
    name: data.name,
    phone: data.phone,
    email: data.email,
    timezone: data.timezone,
    preferredLanguage: data.preferred_language,
  };
}
