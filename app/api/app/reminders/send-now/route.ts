import { NextResponse, type NextRequest } from "next/server";
import { getOwnerSessionState } from "@/lib/auth/owner-guard";
import { createRlsClient } from "@/lib/db/server";
import { runReminderEngineOnce } from "@/lib/engine/reminders";

// The only reminder_type with real seeded template content across verticals today
// (fashion_payment_due, baker_payment_due, ...) -- a generic "send reminder" tap has no way
// to infer which of payment_due/fee_due/appointment/follow_up actually applies to a given
// contact without real conversational understanding, which V1 doesn't have. This is a
// documented limitation, not a guess dressed up as a real choice.
const REMINDER_TYPE = "payment_due";

/**
 * At most one manually-triggered reminder per contact per calendar day -- reminders.
 * idempotency_key is a permanent unique constraint, so this key format is what actually
 * prevents an accidental double-tap (or a retry) from creating a duplicate send, while still
 * allowing a fresh manual reminder tomorrow if genuinely needed again.
 */
function manualIdempotencyKey(contactId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `manual-${contactId}-${REMINDER_TYPE}-${today}`;
}

/**
 * The reminder row itself is inserted through createRlsClient() -- reminders' tenant-
 * isolation RLS policy (business_id in (select business_id from business_memberships where
 * user_id = auth.uid())) is what actually allows or blocks this insert, the same RLS
 * mechanism already proven against cross-tenant reads. Processing the reminder, however, is
 * a legitimate service-role operation: runReminderEngineOnce() is the real Phase 2 engine
 * (the same function app/api/cron/reminders/route.ts calls on a schedule). Calling it
 * directly (not over HTTP) is safe here because this route itself is already behind a
 * verified owner session; the shared secret on /api/cron/reminders exists to gate the
 * *public* HTTP endpoint from an untrusted caller, not to gate trusted server code calling
 * the function directly. It's called below with { onlyReminderId: inserted.id } -- a
 * confirmed cross-tenant fix -- so this manual trigger claims and processes only the single
 * reminder this request just created, not the entire global due-reminder queue. Without
 * that scoping, this call would claim and send any other business's already-due reminder
 * too, as an incidental side effect of one tenant's own action. The cron path (no argument)
 * is unaffected and still drains the full queue every 5 minutes as before.
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

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("business_id", state.businessId)
    .maybeSingle();
  if (contactError) {
    return NextResponse.json({ error: contactError.message }, { status: 500 });
  }
  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  const { data: whatsappChannel, error: channelError } = await supabase
    .from("channels")
    .select("id")
    .eq("name", "whatsapp")
    .single();
  if (channelError) {
    return NextResponse.json({ error: channelError.message }, { status: 500 });
  }

  // The real target channel is decided at processing time by selectReminderChannel() based
  // on the contact's actual identities/consent -- this is just the initial intent, and gets
  // overwritten if the engine routes it elsewhere (e.g. Instagram).
  const initialChannelId = whatsappChannel.id;

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("vertical")
    .eq("id", state.businessId)
    .single();
  if (businessError) {
    return NextResponse.json({ error: businessError.message }, { status: 500 });
  }

  const templateKey = `${business.vertical}_${REMINDER_TYPE}`;
  const { data: businessTemplate } = await supabase
    .from("message_templates")
    .select("id")
    .eq("channel_id", initialChannelId)
    .eq("business_id", state.businessId)
    .eq("template_key", templateKey)
    .eq("category", "utility")
    .eq("active", true)
    .maybeSingle();
  const { data: verticalDefaultTemplate } = businessTemplate
    ? { data: null }
    : await supabase
        .from("message_templates")
        .select("id")
        .eq("channel_id", initialChannelId)
        .is("business_id", null)
        .eq("vertical", business.vertical)
        .eq("template_key", templateKey)
        .eq("category", "utility")
        .eq("active", true)
        .maybeSingle();
  const templateId = businessTemplate?.id ?? verticalDefaultTemplate?.id ?? null;

  const idempotencyKey = manualIdempotencyKey(contactId);

  const { data: inserted, error: insertError } = await supabase
    .from("reminders")
    .insert({
      business_id: state.businessId,
      contact_id: contactId,
      channel_id: initialChannelId,
      reminder_type: REMINDER_TYPE,
      scheduled_time_utc: new Date().toISOString(),
      message_template_id: templateId,
      status: "pending",
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (insertError) {
    // Same contact, same reminder_type, same day -- already sent or in flight.
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "A reminder was already sent to this contact today." }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Runs the real engine synchronously so the owner sees an actual outcome on this single
  // tap, rather than waiting for the next 5-minute cron tick with no feedback at all.
  // Scoped to exactly this reminder -- see runReminderEngineOnce()'s own doc comment.
  await runReminderEngineOnce({ onlyReminderId: inserted.id });

  const { data: finalReminder } = await supabase
    .from("reminders")
    .select("status, failure_reason")
    .eq("id", inserted.id)
    .single();

  await supabase.from("activity_log").insert({
    business_id: state.businessId,
    contact_id: contactId,
    event_type: "reminder_manually_triggered",
    event_detail: { reminder_id: inserted.id, outcome: finalReminder?.status },
    actor_user_id: state.userId,
  });

  return NextResponse.json({
    ok: true,
    status: finalReminder?.status ?? "pending",
    failureReason: finalReminder?.failure_reason ?? null,
  });
}
