import { NextResponse, type NextRequest } from "next/server";
import { getOwnerSessionState } from "@/lib/auth/owner-guard";
import { createRlsClient } from "@/lib/db/server";

/**
 * Manual reconciliation only -- V1 has no in-app payment collection or automated billing
 * (CLAUDE.md's "what NOT to build" list), so this is the owner confirming money that already
 * arrived by some out-of-band means (UPI screenshot, cash, bank transfer), not a payment
 * action of any kind. Sets amount_paid = amount_due rather than accepting a partial-amount
 * input -- V1 has no partial-payment UI anywhere else either, so this route doesn't invent one.
 * activity_log's payment_marked_paid event_type exists specifically for this
 * (docs/architecture/decisions/0014-activity-log-actor-generalization.md's own comment), for
 * exactly the "customer later disputes it" case that comment names.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const state = await getOwnerSessionState();
  if (state.status !== "ready") {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id: paymentId } = await params;
  const supabase = await createRlsClient();

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id, contact_id, order_reference, amount_due, status")
    .eq("id", paymentId)
    .eq("business_id", state.businessId)
    .maybeSingle();
  if (paymentError) {
    return NextResponse.json({ error: paymentError.message }, { status: 500 });
  }
  if (!payment) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  if (payment.status === "paid") {
    return NextResponse.json({ error: "Payment is already marked paid." }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("payments")
    .update({ status: "paid", amount_paid: payment.amount_due, updated_at: new Date().toISOString() })
    .eq("id", paymentId)
    .eq("business_id", state.businessId);
  if (updateError) {
    return NextResponse.json({ error: `Could not mark payment paid: ${updateError.message}` }, { status: 400 });
  }

  await supabase.from("activity_log").insert({
    business_id: state.businessId,
    contact_id: payment.contact_id,
    event_type: "payment_marked_paid",
    event_detail: { payment_id: payment.id, order_reference: payment.order_reference, amount: payment.amount_due },
    actor_user_id: state.userId,
  });

  return NextResponse.json({ ok: true });
}
