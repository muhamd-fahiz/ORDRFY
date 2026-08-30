// Throwaway dev-only fixture data for previewing the owner-app UI against realistic,
// varied data (mixed verticals, mixed pipeline stages, mixed owner_attention_queue states) --
// deliberately NOT part of supabase/seed.sql, which is reference/config content
// (verticals, pipeline_stages, internal_reply_rules, ...) applied by every `db reset`,
// including in CI. This script is safe to re-run: it deletes its own previously-seeded rows
// (matched by a fixed, deterministic id prefix) before recreating them.
//
// GOTCHA (found the hard way, 2026-08-28, now handled automatically): re-running this
// DELETEs and recreates the businesses rows below. business_memberships.business_id is ON
// DELETE CASCADE, so any owner account created against one of these businesses (via the
// admin panel's "Create owner account") silently loses its membership row -- the auth.users
// row survives, the business_memberships link does not. The script now restores membership
// automatically for the two known dev-preview owner emails (see KNOWN_OWNERS below) after
// recreating the businesses, so this is no longer something to remember to fix by hand --
// but it's still worth knowing about if you create an owner account under a *different*
// email against these fixture businesses, since that one isn't in KNOWN_OWNERS.
//
// Usage: node scripts/seed-dev-preview-data.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnvLocal() {
  try {
    const contents = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
    for (const line of contents.split("\n")) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // rely on process.env
  }
}

loadEnvLocal();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Fixed dev-fixture ids (not random) so re-running this script cleanly replaces the same rows.
const BIZ_FASHION = "dead0001-0000-0000-0000-000000000001";
const BIZ_BAKER = "dead0002-0000-0000-0000-000000000002";
const BIZ_SERVICE = "dead0003-0000-0000-0000-000000000003";
const BIZ_TUTOR = "dead0004-0000-0000-0000-000000000004";
const BIZ_GIFT = "dead0005-0000-0000-0000-000000000005";
const ALL_BIZ_IDS = [BIZ_FASHION, BIZ_BAKER, BIZ_SERVICE, BIZ_TUTOR, BIZ_GIFT];

async function main() {
  console.log("Removing any previously-seeded dev preview data...");
  for (const id of ALL_BIZ_IDS) {
    await supabase.from("webhook_events").delete().eq("business_id", id);
    await supabase.from("owner_attention_queue").delete().eq("business_id", id);
    await supabase.from("payments").delete().eq("business_id", id);
    await supabase.from("order_field_values").delete().eq("business_id", id);
    await supabase.from("messages").delete().eq("business_id", id);
    await supabase.from("reminders").delete().eq("business_id", id);
    await supabase.from("business_channel_connections").delete().eq("business_id", id);
    await supabase.from("contact_channel_identities").delete().eq("business_id", id);
    await supabase.from("contacts").delete().eq("business_id", id);
    await supabase.from("businesses").delete().eq("id", id);
  }

  const { data: whatsapp } = await supabase.from("channels").select("id").eq("name", "whatsapp").single();
  const { data: instagram } = await supabase.from("channels").select("id").eq("name", "instagram").single();

  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, vertical, stage_key")
    .is("business_id", null)
    .in("vertical", ["fashion", "baker", "service", "tutor", "gift"]);
  const stageId = (vertical, key) => stages.find((s) => s.vertical === vertical && s.stage_key === key).id;

  console.log("Creating businesses...");
  const { error: bizError } = await supabase.from("businesses").insert([
    { id: BIZ_FASHION, name: "Meera's Tailoring", vertical: "fashion", subscription_status: "active" },
    { id: BIZ_BAKER, name: "Sweet Crumb Bakes", vertical: "baker", subscription_status: "active" },
    { id: BIZ_SERVICE, name: "Glow Studio Appointments", vertical: "service", subscription_status: "active" },
    { id: BIZ_TUTOR, name: "Bright Minds Tuitions", vertical: "tutor", subscription_status: "active" },
    { id: BIZ_GIFT, name: "Wrapped With Love", vertical: "gift", subscription_status: "active" },
  ]);
  if (bizError) throw new Error(`Failed to insert businesses: ${bizError.message}`);

  // Every dev-preview business gets both channels connected -- there is no admin-panel
  // "connect a channel" UI yet (deliberately deferred to Build Phase 6 / real provider
  // integration, ADR-0012), so this is the only way to populate
  // business_channel_connections for Launch Acceptance's webhook-driven testing
  // (lib/engine/business-resolution.ts's resolveBusinessIdFromProviderAccount depends on
  // these rows existing -- found completely empty, for every business, while setting up
  // that pass). provider_account_id values are deterministic per business so a test script
  // can address a specific business+channel without querying for it first.
  console.log("Connecting whatsapp + instagram for every dev-preview business...");
  const connections = ALL_BIZ_IDS.flatMap((businessId) => [
    { business_id: businessId, channel_id: whatsapp.id, provider_account_id: `dev-wa-${businessId}`, connected: true },
    { business_id: businessId, channel_id: instagram.id, provider_account_id: `dev-ig-${businessId}`, connected: true },
  ]);
  const { error: connectionsError } = await supabase.from("business_channel_connections").insert(connections);
  if (connectionsError) throw new Error(`Failed to insert channel connections: ${connectionsError.message}`);

  async function addContact(businessId, vertical, stageKey, name, phone, messageText, messageAgo, attentionReason) {
    // last_inbound_at is set on both contacts and contact_channel_identities, matching the
    // real inbound-message code path (lib/engine/contact-resolution.ts) now that it does the
    // same -- keeping this fixture consistent with production behavior rather than
    // reproducing the staleness bug that behavior used to have.
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .insert({ business_id: businessId, name, pipeline_stage_id: stageId(vertical, stageKey), last_inbound_at: messageAgo })
      .select("id")
      .single();
    if (contactError) throw new Error(`Failed to insert contact ${name}: ${contactError.message}`);

    const { error: identityError } = await supabase.from("contact_channel_identities").insert({
      contact_id: contact.id,
      business_id: businessId,
      channel_id: whatsapp.id,
      provider_user_id: phone,
      phone_number: phone,
      last_inbound_at: messageAgo,
    });
    if (identityError) throw new Error(`Failed to insert identity for ${name}: ${identityError.message}`);

    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        contact_id: contact.id,
        business_id: businessId,
        channel_id: whatsapp.id,
        direction: "inbound",
        content: messageText,
        provider: "mock-whatsapp",
        provider_message_id: `dev-preview-${contact.id}`,
        created_at: messageAgo,
      })
      .select("id")
      .single();
    if (messageError) throw new Error(`Failed to insert message for ${name}: ${messageError.message}`);

    if (attentionReason) {
      const { error: attentionError } = await supabase.from("owner_attention_queue").insert({
        business_id: businessId,
        contact_id: contact.id,
        reason: attentionReason,
        reference_type: "message",
        reference_id: message.id,
      });
      if (attentionError) throw new Error(`Failed to insert attention item for ${name}: ${attentionError.message}`);
    }

    return contact.id;
  }

  async function addPayment(businessId, contactId, name, { orderReference, amountDue, amountPaid, status, dueDaysFromNow }) {
    const { error } = await supabase.from("payments").insert({
      business_id: businessId,
      contact_id: contactId,
      order_reference: orderReference,
      amount_due: amountDue,
      amount_paid: amountPaid,
      status,
      due_date: new Date(Date.now() + dueDaysFromNow * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });
    if (error) throw new Error(`Failed to insert payment for ${name}: ${error.message}`);
  }

  async function addFieldValues(businessId, contactId, name, vertical, values) {
    const { data: defs, error: defsError } = await supabase
      .from("vertical_field_definitions")
      .select("id, field_key, field_type")
      .eq("vertical", vertical);
    if (defsError) throw new Error(`Failed to load field definitions for ${vertical}: ${defsError.message}`);

    for (const [fieldKey, rawValue] of Object.entries(values)) {
      const def = defs.find((d) => d.field_key === fieldKey);
      if (!def) throw new Error(`Unknown field_key "${fieldKey}" for vertical ${vertical}`);

      const valueColumn = { text: "value_text", select: "value_text", number: "value_number", boolean: "value_boolean", date: "value_date" }[def.field_type];
      const { error } = await supabase.from("order_field_values").insert({
        contact_id: contactId,
        business_id: businessId,
        field_definition_id: def.id,
        [valueColumn]: rawValue,
      });
      if (error) throw new Error(`Failed to insert field value ${fieldKey} for ${name}: ${error.message}`);
    }
  }

  console.log("Creating contacts, messages, and attention-queue entries...");
  const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

  // Meera's Tailoring (fashion) -- 2 unresolved attention items. Fashion has zero
  // vertical_field_definitions (only baker/gift do) -- Priya/Ananya deliberately get no
  // order_field_values, proving the contact-detail screen's "no vertical fields for this
  // business type" state, not just the populated one.
  const priyaId = await addContact(BIZ_FASHION, "fashion", "new_inquiry", "Priya K.", "+919991110001", "Is the blue kurta ready yet?", hoursAgo(48), "unmatched_message");
  const rahulId = await addContact(BIZ_FASHION, "fashion", "paid", "Rahul S.", "+919991110002", "Payment done, thank you!", hoursAgo(1), null);
  const ananyaId = await addContact(BIZ_FASHION, "fashion", "order_confirmed", "Ananya", "+919991110003", "Can I get it by Friday or Saturday, still deciding", hoursAgo(6), "ambiguous_match");
  await addPayment(BIZ_FASHION, rahulId, "Rahul S.", { orderReference: "ORD-1042", amountDue: 1850, amountPaid: 1850, status: "paid", dueDaysFromNow: -3 });
  await addPayment(BIZ_FASHION, ananyaId, "Ananya", { orderReference: "ORD-1043", amountDue: 3200, amountPaid: 0, status: "overdue", dueDaysFromNow: -1 });
  // Priya: no payment yet -- too early (still New Inquiry) -- proves the "no payments" state.

  // Sweet Crumb Bakes (baker) -- 1 unresolved, and a "cancelled" stage to prove chips don't
  // mislabel it as a success state just because pipeline_stages.sort_order is highest there.
  // Baker has 13 real vertical_field_definitions -- Kavya gets most of them populated
  // (a fuller order), Deepak gets almost none (cancelled early), Sana gets exactly one
  // (occasion -- just inquired, nothing else decided) -- a realistic spread of completeness.
  const kavyaId = await addContact(BIZ_BAKER, "baker", "awaiting_advance_payment", "Kavya", "+919992220001", "Sent the payment screenshot on WhatsApp", hoursAgo(3), null);
  const deepakId = await addContact(BIZ_BAKER, "baker", "cancelled", "Deepak", "+919992220002", "Actually please cancel my order, sorry", hoursAgo(20), null);
  const sanaId = await addContact(BIZ_BAKER, "baker", "new_inquiry", "Sana", "+919992220003", "Can you do a 2kg chocolate cake for Saturday?", hoursAgo(2), "unmatched_message");
  await addFieldValues(BIZ_BAKER, kavyaId, "Kavya", "baker", {
    occasion: "Anniversary",
    cake_flavour: "Black Forest",
    cake_size_weight: "1.5 kg",
    egg_or_eggless: "Eggless",
    custom_design_requirements: "Two-tier with fresh flowers",
    quantity: 1,
    pickup_or_delivery: "Delivery",
    delivery_pickup_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    delivery_address: "12 MG Road, Bengaluru",
  });
  await addFieldValues(BIZ_BAKER, deepakId, "Deepak", "baker", { cake_flavour: "Chocolate", quantity: 1 });
  await addFieldValues(BIZ_BAKER, sanaId, "Sana", "baker", { occasion: "Birthday" });
  await addPayment(BIZ_BAKER, kavyaId, "Kavya", { orderReference: "ORD-2001", amountDue: 1800, amountPaid: 900, status: "pending", dueDaysFromNow: 3 });
  // Deepak (cancelled) and Sana (brand-new inquiry): no payments yet.

  // Glow Studio Appointments (service) -- 0 unresolved, proves the attention banner hides
  // itself cleanly rather than rendering "0" or an empty bar. Service also has zero
  // vertical_field_definitions, like fashion.
  const fatimaId = await addContact(BIZ_SERVICE, "service", "confirmed", "Fatima", "+919993330001", "See you at 4pm!", hoursAgo(5), null);
  await addContact(BIZ_SERVICE, "service", "inquiry", "Zoya", "+919993330002", "Do you have any evening slots this week?", hoursAgo(30), null);
  await addPayment(BIZ_SERVICE, fatimaId, "Fatima", { orderReference: "ORD-3001", amountDue: 500, amountPaid: 500, status: "paid", dueDaysFromNow: -5 });

  // Bright Minds Tuitions (tutor) -- tutor has zero vertical_field_definitions, like
  // fashion/service, so no addFieldValues calls here either.
  const rohitId = await addContact(BIZ_TUTOR, "tutor", "enrolled", "Rohit's Parent", "+919994440001", "Can we shift Rohit's Tuesday class?", hoursAgo(4), null);
  await addContact(BIZ_TUTOR, "tutor", "parent_inquiry", "Anjali's Parent", "+919994440002", "What are your fees for class 8 maths?", hoursAgo(15), "unmatched_message");
  await addPayment(BIZ_TUTOR, rohitId, "Rohit's Parent", { orderReference: "FEE-SEP", amountDue: 2400, amountPaid: 2400, status: "paid", dueDaysFromNow: -2 });

  // Wrapped With Love (gift) -- gift has 17 vertical_field_definitions; Meher gets a fuller
  // order, Arjun gets just the occasion (early inquiry).
  const meherId = await addContact(BIZ_GIFT, "gift", "awaiting_advance_payment", "Meher", "+919995550001", "Can you engrave 'A & R, 12.09' on it?", hoursAgo(7), null);
  const arjunId = await addContact(BIZ_GIFT, "gift", "new_inquiry", "Arjun", "+919995550002", "Need a birthday gift idea for my sister", hoursAgo(1), "unmatched_message");
  await addFieldValues(BIZ_GIFT, meherId, "Meher", "gift", {
    recipient_name: "R",
    occasion: "Anniversary",
    gift_type: "Engraved photo frame",
    personalization_required: true,
    name_to_include: "A & R, 12.09",
    quantity: 1,
    surprise_required: true,
    delivery_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });
  await addFieldValues(BIZ_GIFT, arjunId, "Arjun", "gift", { occasion: "Birthday" });
  await addPayment(BIZ_GIFT, meherId, "Meher", { orderReference: "ORD-4001", amountDue: 1150, amountPaid: 400, status: "pending", dueDaysFromNow: 5 });

  // Auto-restore any owner accounts created against these fixture businesses -- the
  // cascade-delete gotcha documented at the top of this file is real, but re-fixing it by
  // hand every time this script runs is exactly the kind of avoidable friction worth
  // eliminating rather than re-explaining. Safe no-op for anyone who hasn't created these.
  console.log("Restoring known dev-preview owner accounts, if they exist...");
  const KNOWN_OWNERS = [
    { email: "meera.owner@example.com", businessId: BIZ_FASHION },
    { email: "sweetcrumb.owner@example.com", businessId: BIZ_BAKER },
  ];
  for (const { email, businessId } of KNOWN_OWNERS) {
    const { data: user } = await supabase.auth.admin.listUsers();
    const match = user?.users.find((u) => u.email === email);
    if (!match) continue;
    const { error } = await supabase
      .from("business_memberships")
      .upsert({ user_id: match.id, business_id: businessId, role: "owner" }, { onConflict: "user_id,business_id" });
    if (error) throw new Error(`Failed to restore membership for ${email}: ${error.message}`);
    console.log(`Restored membership: ${email} -> ${businessId}`);
  }

  console.log("Done. Business ids:");
  console.log({ BIZ_FASHION, BIZ_BAKER, BIZ_SERVICE, BIZ_TUTOR, BIZ_GIFT });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
