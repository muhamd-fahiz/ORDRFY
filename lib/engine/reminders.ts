import { createServiceRoleClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/database.types";
import { getChannelProvider } from "@/lib/channels/factory";
import { isAutomationEligibleForBilling, type SubscriptionStatus } from "./trial-eligibility";
import { selectReminderChannel, type WhatsAppIdentityInput } from "./channel-selection";

type Reminder = Database["public"]["Tables"]["reminders"]["Row"];

const DEFAULT_TRIAL_GRACE_PERIOD_DAYS = 3;
const MAX_REMINDERS_PER_RUN = 200;
const MAX_ATTEMPTS = 5;
// Matches the pg_cron schedule interval (20260828120028_reminder_engine_cron.sql,
// '*/5 * * * *'). A paused reminder must be pushed past "now" by at least this much, or
// claim_next_reminder() (which selects on scheduled_time_utc <= now()) reclaims the exact
// same reminder on the very next loop iteration -- confirmed against the live stack: a
// single paused reminder consumed the entire MAX_REMINDERS_PER_RUN budget in one run
// instead of waiting for the next tick.
const PAUSED_RETRY_DELAY_MINUTES = 5;
// Retry backoff on a transient provider error (Ordrfy-Final-Architecture.pdf Section 3c):
// 5 min, 30 min, 2h, 2h, 2h -- capped, not unbounded.
const BACKOFF_MINUTES = [5, 30, 120, 120, 120];

export interface ReminderEngineRunResult {
  claimed: number;
  sent: number;
  failed: number;
  rescheduled: number;
  skippedPaused: number;
  recoveredStuck: number;
}

/**
 * One full scheduler tick: recover anything stuck from a crashed prior run, then claim and
 * process due reminders one at a time via FOR UPDATE SKIP LOCKED until none remain (capped
 * at MAX_REMINDERS_PER_RUN so one invocation can't run forever), then record the heartbeat.
 * Called by app/api/cron/reminders/route.ts, which pg_cron/pg_net invoke on a schedule.
 *
 * `onlyReminderId` (confirmed cross-tenant fix): app/api/app/reminders/send-now/route.ts
 * calls this synchronously so an owner's manual "Send Reminder" tap gets a real outcome, but
 * without it this function would drain the *global* due-reminder queue -- claiming and
 * sending any other business's already-due reminder too, up to MAX_REMINDERS_PER_RUN of
 * them, as an incidental side effect of one tenant's own action. Passing the specific
 * reminder id that route just inserted scopes a manual trigger to exactly that one row;
 * the cron path (called with no argument) is completely unaffected and still drains the
 * full global queue exactly as before.
 */
export async function runReminderEngineOnce(
  options: { onlyReminderId?: string } = {},
): Promise<ReminderEngineRunResult> {
  const supabase = createServiceRoleClient();
  const result: ReminderEngineRunResult = {
    claimed: 0,
    sent: 0,
    failed: 0,
    rescheduled: 0,
    skippedPaused: 0,
    recoveredStuck: 0,
  };

  const { data: recoveredCount } = await supabase.rpc("recover_stuck_reminders", { p_timeout_minutes: 10 });
  result.recoveredStuck = recoveredCount ?? 0;

  if (options.onlyReminderId) {
    // Plain conditional UPDATE...WHERE status='pending'...RETURNING is already atomic (the
    // UPDATE takes the row lock itself) -- FOR UPDATE SKIP LOCKED's extra behavior only
    // matters when choosing among *many* candidate rows, which claim_next_reminder() needs
    // and this single-target claim does not.
    const { data: reminder, error } = await supabase
      .from("reminders")
      .update({ status: "processing", locked_at: new Date().toISOString() })
      .eq("id", options.onlyReminderId)
      .eq("status", "pending")
      .select()
      .maybeSingle();
    if (error) throw new Error(`Failed to claim reminder ${options.onlyReminderId}: ${error.message}`);
    if (reminder) {
      result.claimed++;
      const outcome = await processReminder(supabase, reminder);
      result[outcome]++;
    }
    await supabase.rpc("record_reminder_engine_heartbeat");
    return result;
  }

  for (let i = 0; i < MAX_REMINDERS_PER_RUN; i++) {
    // No `.single()` here: claim_next_reminder() already returns one composite row (or a
    // row with every field null when nothing was due) -- `.single()` is for narrowing an
    // array-returning query, not a scalar RPC result, and confuses the generated types.
    const { data: reminder, error } = await supabase.rpc("claim_next_reminder");
    if (error) throw new Error(`claim_next_reminder failed: ${error.message}`);
    if (!reminder || !reminder.id) break;

    result.claimed++;
    const outcome = await processReminder(supabase, reminder);
    result[outcome]++;
  }

  await supabase.rpc("record_reminder_engine_heartbeat");
  return result;
}

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

async function processReminder(
  supabase: ServiceClient,
  reminder: Reminder,
): Promise<"sent" | "failed" | "rescheduled" | "skippedPaused"> {
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("automation_paused, subscription_status, trial_ends_at")
    .eq("id", reminder.business_id)
    .single();
  if (businessError) throw new Error(`Business lookup failed: ${businessError.message}`);

  // Kill switch: leave it pending, to retry next cycle once unpaused -- this is meant to be
  // temporary, so this is not a failure and attempt_count is not incremented. scheduled_time_utc
  // is pushed forward so this same reminder isn't immediately reclaimable within this same
  // run's loop (see PAUSED_RETRY_DELAY_MINUTES).
  if (business.automation_paused) {
    await supabase
      .from("reminders")
      .update({
        status: "pending",
        locked_at: null,
        scheduled_time_utc: new Date(Date.now() + PAUSED_RETRY_DELAY_MINUTES * 60 * 1000).toISOString(),
      })
      .eq("id", reminder.id);
    return "skippedPaused";
  }

  const { data: settingsRow } = await supabase
    .from("business_settings")
    .select("setting_value")
    .eq("business_id", reminder.business_id)
    .eq("setting_key", "trial_grace_period_days")
    .maybeSingle();
  const gracePeriodDays = settingsRow ? Number(settingsRow.setting_value) : DEFAULT_TRIAL_GRACE_PERIOD_DAYS;

  const billingEligible = isAutomationEligibleForBilling({
    // businesses.subscription_status is a `text check (...)` column, not a real Postgres
    // enum (deliberate schema choice for flexibility) -- codegen types it as plain string;
    // the DB CHECK constraint is what actually guarantees one of these three values.
    subscriptionStatus: business.subscription_status as SubscriptionStatus,
    trialEndsAt: business.trial_ends_at,
    gracePeriodDays,
  });
  if (!billingEligible) {
    await supabase
      .from("reminders")
      .update({ status: "failed", failure_reason: "trial_expired", locked_at: null })
      .eq("id", reminder.id);
    return "failed";
  }

  const [{ data: whatsappChannel }, { data: instagramChannel }] = await Promise.all([
    supabase.from("channels").select("id").eq("name", "whatsapp").single(),
    supabase.from("channels").select("id").eq("name", "instagram").single(),
  ]);

  // business_id is included on both lookups as defense-in-depth, not just contact_id: the
  // service-role client bypasses RLS, and contact_id alone doesn't guarantee the identity
  // belongs to *this* reminder's business (see the guard_contact_business_match trigger,
  // 20260902000001, which is the primary defense against a mismatched row ever existing --
  // this is the second, independent layer in case any future write path bypasses it).
  const [{ data: whatsappIdentity }, { data: instagramIdentity }] = await Promise.all([
    supabase
      .from("contact_channel_identities")
      .select("id, opted_out_at")
      .eq("contact_id", reminder.contact_id)
      .eq("business_id", reminder.business_id)
      .eq("channel_id", whatsappChannel!.id)
      .maybeSingle(),
    supabase
      .from("contact_channel_identities")
      .select("id, opted_out_at, last_inbound_at")
      .eq("contact_id", reminder.contact_id)
      .eq("business_id", reminder.business_id)
      .eq("channel_id", instagramChannel!.id)
      .maybeSingle(),
  ]);

  const { data: consentRow } = whatsappIdentity
    ? await supabase
        .from("current_reminder_channel_consent")
        .select("status")
        .eq("contact_id", reminder.contact_id)
        .eq("requested_channel_id", whatsappChannel!.id)
        .maybeSingle()
    : { data: null };

  const selection = selectReminderChannel({
    whatsapp: whatsappIdentity
      ? {
          optedOutAt: whatsappIdentity.opted_out_at,
          // current_reminder_channel_consent is a view -- its CHECK constraint on the
          // underlying table doesn't carry through to the generated column type, so this
          // is typed as a plain string. The DB guarantees it's one of the five values.
          consentStatus: (consentRow?.status ?? null) as WhatsAppIdentityInput["consentStatus"],
        }
      : null,
    instagram: instagramIdentity
      ? { optedOutAt: instagramIdentity.opted_out_at, lastInboundAt: instagramIdentity.last_inbound_at }
      : null,
  });

  if (selection.outcome === "unsupported") {
    await supabase
      .from("reminders")
      .update({ status: "failed", failure_reason: "channel_unsupported", locked_at: null })
      .eq("id", reminder.id);
    await supabase.from("owner_attention_queue").insert({
      business_id: reminder.business_id,
      contact_id: reminder.contact_id,
      reason: "reminder_channel_unsupported",
      reference_type: "reminder",
      reference_id: reminder.id,
    });
    return "failed";
  }

  const targetChannelId = selection.outcome === "whatsapp" ? whatsappChannel!.id : instagramChannel!.id;

  try {
    const providerUserId = await resolveProviderUserId(supabase, reminder.contact_id, reminder.business_id, targetChannelId);
    const content = await resolveReminderContent(supabase, reminder, selection.outcome);

    const provider = getChannelProvider(selection.outcome);
    const providerMessageId = await provider.sendMessage(providerUserId, content);

    await supabase
      .from("reminders")
      .update({ status: "sent", channel_id: targetChannelId, locked_at: null })
      .eq("id", reminder.id);

    await supabase.from("messages").insert({
      contact_id: reminder.contact_id,
      business_id: reminder.business_id,
      channel_id: targetChannelId,
      direction: "outbound",
      content: content.text ?? `[template:${content.templateName}]`,
      provider: selection.outcome === "whatsapp" ? "mock-whatsapp" : "mock-instagram",
      provider_message_id: providerMessageId,
      send_status: "sent",
    });

    await supabase.from("activity_log").insert({
      business_id: reminder.business_id,
      contact_id: reminder.contact_id,
      event_type: "reminder_sent",
      event_detail: { reminder_id: reminder.id, channel: selection.outcome },
    });

    return "sent";
  } catch (sendError) {
    return handleSendFailure(supabase, reminder, sendError);
  }
}

async function resolveProviderUserId(
  supabase: ServiceClient,
  contactId: string,
  businessId: string,
  channelId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("contact_channel_identities")
    .select("provider_user_id")
    .eq("contact_id", contactId)
    .eq("business_id", businessId)
    .eq("channel_id", channelId)
    .single();
  if (error) throw new Error(`Could not resolve provider_user_id: ${error.message}`);
  return data.provider_user_id;
}

async function resolveReminderContent(
  supabase: ServiceClient,
  reminder: Reminder,
  outcome: "whatsapp" | "instagram",
): Promise<{ text?: string; templateName?: string }> {
  if (outcome === "whatsapp" && reminder.message_template_id) {
    const { data: template, error } = await supabase
      .from("message_templates")
      .select("meta_template_name, reply_text")
      .eq("id", reminder.message_template_id)
      .single();
    if (error) throw new Error(`Reminder template lookup failed: ${error.message}`);
    return template.meta_template_name
      ? { templateName: template.meta_template_name }
      : { text: template.reply_text ?? "Reminder" };
  }

  // Instagram reminders sent within an open window use reply_text directly -- not a real
  // Meta-approved template (message_templates comment, Ordrfy-Final-Architecture.pdf
  // Section 10 generalization).
  const { data: channelRow } = await supabase.from("channels").select("id").eq("name", outcome).single();
  const { data: template } = await supabase
    .from("message_templates")
    .select("reply_text")
    .eq("channel_id", channelRow!.id)
    .eq("template_key", await resolveTemplateKeyForReminderType(supabase, reminder))
    .maybeSingle();

  return { text: template?.reply_text ?? "This is a reminder." };
}

/**
 * Best-effort mapping from a generic reminder_type back to a seeded template_key so
 * Instagram sends have real vertical/reminder-specific copy instead of a generic
 * fallback string. Not a schema-level FK on purpose -- reminder_type is intentionally
 * free text (per-vertical values), and this mapping is allowed to be imperfect for a
 * reminder_type no seed content exists for yet, falling back to the generic string above.
 */
async function resolveTemplateKeyForReminderType(supabase: ServiceClient, reminder: Reminder): Promise<string> {
  const { data: business } = await supabase
    .from("businesses")
    .select("vertical")
    .eq("id", reminder.business_id)
    .single();
  return `${business?.vertical}_${reminder.reminder_type}`;
}

async function handleSendFailure(
  supabase: ServiceClient,
  reminder: Reminder,
  sendError: unknown,
): Promise<"failed" | "rescheduled"> {
  const nextAttempt = reminder.attempt_count + 1;

  if (nextAttempt >= MAX_ATTEMPTS) {
    await supabase
      .from("reminders")
      .update({ status: "failed", failure_reason: "provider_error", attempt_count: nextAttempt, locked_at: null })
      .eq("id", reminder.id);
    await supabase.from("owner_attention_queue").insert({
      business_id: reminder.business_id,
      contact_id: reminder.contact_id,
      reason: "manual_flag",
      reference_type: "reminder",
      reference_id: reminder.id,
    });
    return "failed";
  }

  const backoffMinutes = BACKOFF_MINUTES[Math.min(nextAttempt - 1, BACKOFF_MINUTES.length - 1)]!;
  const nextScheduledTime = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

  await supabase
    .from("reminders")
    .update({
      status: "pending",
      attempt_count: nextAttempt,
      scheduled_time_utc: nextScheduledTime,
      locked_at: null,
    })
    .eq("id", reminder.id);

  await supabase.from("activity_log").insert({
    business_id: reminder.business_id,
    contact_id: reminder.contact_id,
    event_type: "reminder_send_retry_scheduled",
    event_detail: { reminder_id: reminder.id, attempt: nextAttempt, error: String(sendError) },
  });

  return "rescheduled";
}
