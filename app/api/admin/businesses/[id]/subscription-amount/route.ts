import { NextResponse, type NextRequest } from "next/server";
import { getAdminSessionState } from "@/lib/auth/admin-guard";
import { createServiceRoleClient } from "@/lib/db/server";

/**
 * The "simple" half of the Subscriptions tab (ADR-0033): one manually-editable per-business
 * amount, stored as a business_settings row -- not a real invoice/payment history. No
 * schema change (business_settings already exists for exactly this kind of per-business
 * override). Deliberately no automation here: this is the project owner recording what's
 * actually been agreed per business today, not a billing system that charges anyone.
 */
const SETTING_KEY = "subscription_amount_inr";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const state = await getAdminSessionState();
  if (state.status !== "ready") {
    return NextResponse.json({ error: "Not signed in as an admin." }, { status: 401 });
  }
  const { id: businessId } = await params;

  const { amount } = (await request.json()) as { amount?: number | null };
  if (amount !== null && amount !== undefined && (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0)) {
    return NextResponse.json({ error: "Amount must be a non-negative number." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  if (amount === null || amount === undefined) {
    const { error } = await supabase
      .from("business_settings")
      .delete()
      .eq("business_id", businessId)
      .eq("setting_key", SETTING_KEY);
    if (error) {
      return NextResponse.json({ error: `Could not clear amount: ${error.message}` }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("business_settings")
    .upsert(
      { business_id: businessId, setting_key: SETTING_KEY, setting_value: String(amount) },
      { onConflict: "business_id,setting_key" },
    );
  if (error) {
    return NextResponse.json({ error: `Could not save amount: ${error.message}` }, { status: 400 });
  }

  await supabase.from("activity_log").insert({
    business_id: businessId,
    event_type: "subscription_amount_updated",
    event_detail: { amount },
    actor_user_id: state.userId,
  });

  return NextResponse.json({ ok: true });
}
