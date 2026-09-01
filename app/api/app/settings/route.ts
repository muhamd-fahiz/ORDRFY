import { NextResponse, type NextRequest } from "next/server";
import { getOwnerSessionState } from "@/lib/auth/owner-guard";
import { createRlsClient } from "@/lib/db/server";

interface SettingsBody {
  name?: string;
  phone?: string | null;
  email?: string | null;
  timezone?: string;
  preferredLanguage?: string;
}

// Matches the owner-app Settings screen's own dropdown options (see
// app/app/(protected)/settings/settings-form.tsx) -- every business created so far is
// India-based. A business's own already-stored value is always allowed too (checked below
// against `before.timezone`), so this never rejects a value nothing here put there.
const KNOWN_TIMEZONES = new Set(["Asia/Kolkata"]);

/**
 * Owner self-service edit of their own business profile -- name/phone/email/timezone/
 * preferred_language only (see lib/data/business-profile.ts for why `vertical` and
 * subscription/kill-switch fields are excluded; those stay admin-only). Runs through
 * createRlsClient() -- tenant_isolation_businesses is what actually scopes this UPDATE to
 * the caller's own row, not the .eq("id", ...) filter below, which is belt-and-suspenders.
 */
export async function POST(request: NextRequest) {
  const state = await getOwnerSessionState();
  if (state.status !== "ready") {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await request.json()) as SettingsBody;
  const name = body.name?.trim();
  const timezone = body.timezone?.trim();
  const preferredLanguage = body.preferredLanguage?.trim();
  const phone = body.phone?.trim() || null;
  const email = body.email?.trim() || null;

  if (!name) {
    return NextResponse.json({ error: "Business name is required." }, { status: 400 });
  }
  if (!timezone) {
    return NextResponse.json({ error: "Timezone is required." }, { status: 400 });
  }
  if (!preferredLanguage) {
    return NextResponse.json({ error: "Preferred language is required." }, { status: 400 });
  }

  const supabase = await createRlsClient();

  const { data: before, error: beforeError } = await supabase
    .from("businesses")
    .select("name, phone, email, timezone, preferred_language")
    .eq("id", state.businessId)
    .single();
  if (beforeError) {
    return NextResponse.json({ error: beforeError.message }, { status: 500 });
  }

  if (!KNOWN_TIMEZONES.has(timezone) && timezone !== before.timezone) {
    return NextResponse.json({ error: "That timezone isn't recognized." }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("businesses")
    .update({ name, phone, email, timezone, preferred_language: preferredLanguage })
    .eq("id", state.businessId);
  if (updateError) {
    return NextResponse.json({ error: `Could not save settings: ${updateError.message}` }, { status: 400 });
  }

  await supabase.from("activity_log").insert({
    business_id: state.businessId,
    event_type: "business_profile_updated",
    event_detail: {
      before: { name: before.name, phone: before.phone, email: before.email, timezone: before.timezone, preferred_language: before.preferred_language },
      after: { name, phone, email, timezone, preferred_language: preferredLanguage },
    },
    actor_user_id: state.userId,
  });

  return NextResponse.json({ ok: true });
}
