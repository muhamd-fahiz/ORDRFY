// Throwaway dev-only fixture data for previewing the owner-app UI against realistic,
// varied data (mixed verticals, mixed pipeline stages, mixed owner_attention_queue states) --
// deliberately NOT part of supabase/seed.sql, which is reference/config content
// (verticals, pipeline_stages, internal_reply_rules, ...) applied by every `db reset`,
// including in CI. This script is safe to re-run: it deletes its own previously-seeded rows
// (matched by a fixed, deterministic id prefix) before recreating them.
//
// GOTCHA (found the hard way, 2026-08-29): re-running this DELETEs and recreates the
// businesses rows below. business_memberships.business_id is ON DELETE CASCADE, so any
// owner account created against one of these businesses (via the admin panel's "Create
// owner account") silently loses its membership row -- the auth.users row survives, the
// business_memberships link does not. If you've created a real owner login against these
// fixture businesses for testing, re-run this script BEFORE recreating that login, or
// re-insert the membership row manually afterward:
//   insert into business_memberships (user_id, business_id, role)
//   select id, '<business-id>', 'owner' from auth.users where email = '<owner-email>';
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

async function main() {
  console.log("Removing any previously-seeded dev preview data...");
  for (const id of [BIZ_FASHION, BIZ_BAKER, BIZ_SERVICE]) {
    await supabase.from("webhook_events").delete().eq("business_id", id);
    await supabase.from("owner_attention_queue").delete().eq("business_id", id);
    await supabase.from("messages").delete().eq("business_id", id);
    await supabase.from("reminders").delete().eq("business_id", id);
    await supabase.from("contact_channel_identities").delete().eq("business_id", id);
    await supabase.from("contacts").delete().eq("business_id", id);
    await supabase.from("businesses").delete().eq("id", id);
  }

  const { data: whatsapp } = await supabase.from("channels").select("id").eq("name", "whatsapp").single();

  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id, vertical, stage_key")
    .is("business_id", null)
    .in("vertical", ["fashion", "baker", "service"]);
  const stageId = (vertical, key) => stages.find((s) => s.vertical === vertical && s.stage_key === key).id;

  console.log("Creating businesses...");
  const { error: bizError } = await supabase.from("businesses").insert([
    { id: BIZ_FASHION, name: "Meera's Tailoring", vertical: "fashion", subscription_status: "active" },
    { id: BIZ_BAKER, name: "Sweet Crumb Bakes", vertical: "baker", subscription_status: "active" },
    { id: BIZ_SERVICE, name: "Glow Studio Appointments", vertical: "service", subscription_status: "active" },
  ]);
  if (bizError) throw new Error(`Failed to insert businesses: ${bizError.message}`);

  async function addContact(businessId, vertical, stageKey, name, phone, messageText, messageAgo, attentionReason) {
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .insert({ business_id: businessId, name, pipeline_stage_id: stageId(vertical, stageKey) })
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
  }

  console.log("Creating contacts, messages, and attention-queue entries...");
  const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

  // Meera's Tailoring (fashion) -- 2 unresolved attention items.
  await addContact(BIZ_FASHION, "fashion", "new_inquiry", "Priya K.", "+919991110001", "Is the blue kurta ready yet?", hoursAgo(48), "unmatched_message");
  await addContact(BIZ_FASHION, "fashion", "paid", "Rahul S.", "+919991110002", "Payment done, thank you!", hoursAgo(1), null);
  await addContact(BIZ_FASHION, "fashion", "order_confirmed", "Ananya", "+919991110003", "Can I get it by Friday or Saturday, still deciding", hoursAgo(6), "ambiguous_match");

  // Sweet Crumb Bakes (baker) -- 1 unresolved, and a "cancelled" stage to prove chips don't
  // mislabel it as a success state just because pipeline_stages.sort_order is highest there.
  await addContact(BIZ_BAKER, "baker", "awaiting_advance_payment", "Kavya", "+919992220001", "Sent the payment screenshot on WhatsApp", hoursAgo(3), null);
  await addContact(BIZ_BAKER, "baker", "cancelled", "Deepak", "+919992220002", "Actually please cancel my order, sorry", hoursAgo(20), null);
  await addContact(BIZ_BAKER, "baker", "new_inquiry", "Sana", "+919992220003", "Can you do a 2kg chocolate cake for Saturday?", hoursAgo(2), "unmatched_message");

  // Glow Studio Appointments (service) -- 0 unresolved, proves the attention banner hides
  // itself cleanly rather than rendering "0" or an empty bar.
  await addContact(BIZ_SERVICE, "service", "confirmed", "Fatima", "+919993330001", "See you at 4pm!", hoursAgo(5), null);
  await addContact(BIZ_SERVICE, "service", "inquiry", "Zoya", "+919993330002", "Do you have any evening slots this week?", hoursAgo(30), null);

  console.log("Done. Business ids:");
  console.log({ BIZ_FASHION, BIZ_BAKER, BIZ_SERVICE });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
