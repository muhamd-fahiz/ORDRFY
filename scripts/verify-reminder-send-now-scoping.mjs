// Confirmed cross-tenant fix verification (Finding 1): proves that an owner's manual "Send
// Reminder" tap (POST /api/app/reminders/send-now) processes ONLY the single reminder that
// request just created, and does NOT drain the global due-reminder queue -- before the fix,
// this call ran runReminderEngineOnce() with no scoping at all, which would claim and send
// ANY other business's already-due reminder too, as an incidental side effect of one
// tenant's own action.
//
// Uses the REAL route (not a fixture insert) for the part that matters -- the manual
// trigger itself -- matching this project's own established "test through the real path"
// convention (see scripts/launch-acceptance-check.mjs). Everything else (seeding two
// businesses, a separately-due reminder for the "other" business, a throwaway owner
// account) is service-role setup so the test is fully self-contained and re-runnable.
//
// Requires: the dev server running at DEV_SERVER_URL (default http://localhost:3100).
// Usage: node scripts/verify-reminder-send-now-scoping.mjs

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

const DEV_SERVER_URL = process.env.DEV_SERVER_URL ?? "http://localhost:3100";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const rand = () => Math.random().toString(36).slice(2, 10);
const suffix = rand();

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} -- ${name}${detail ? ` (${detail})` : ""}`);
}

function extractCookieHeader(response) {
  const setCookies = response.headers.getSetCookie?.() ?? [];
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

async function main() {
  const ownerEmail = `scoping-test-${suffix}@example.com`;
  const ownerPassword = `ScopingTest-${suffix}-1!`;

  let bizAId, bizBId, contactAId, contactBId, userId, reminderBId;

  try {
    // --- Seed: two businesses, each with one contact ---------------------------------
    const { data: businesses, error: bizError } = await supabase
      .from("businesses")
      .insert([
        { name: `Scoping Test Biz A ${suffix}`, vertical: "fashion", subscription_status: "active" },
        { name: `Scoping Test Biz B ${suffix}`, vertical: "fashion", subscription_status: "active" },
      ])
      .select("id");
    if (bizError) throw new Error(`Failed to seed businesses: ${bizError.message}`);
    [bizAId, bizBId] = businesses.map((b) => b.id);

    const { data: contacts, error: contactError } = await supabase
      .from("contacts")
      .insert([
        { business_id: bizAId, name: "Scoping Test Contact A" },
        { business_id: bizBId, name: "Scoping Test Contact B" },
      ])
      .select("id, business_id");
    if (contactError) throw new Error(`Failed to seed contacts: ${contactError.message}`);
    contactAId = contacts.find((c) => c.business_id === bizAId).id;
    contactBId = contacts.find((c) => c.business_id === bizBId).id;

    // --- Seed: Business B's own, already-due reminder, entirely unrelated to A's action ---
    const { data: whatsappChannel } = await supabase.from("channels").select("id").eq("name", "whatsapp").single();
    const { data: reminderB, error: reminderBError } = await supabase
      .from("reminders")
      .insert({
        business_id: bizBId,
        contact_id: contactBId,
        channel_id: whatsappChannel.id,
        reminder_type: "payment_due",
        scheduled_time_utc: new Date(Date.now() - 60_000).toISOString(), // already due
        status: "pending",
        idempotency_key: `scoping-test-b-${suffix}`,
      })
      .select("id")
      .single();
    if (reminderBError) throw new Error(`Failed to seed Business B's reminder: ${reminderBError.message}`);
    reminderBId = reminderB.id;

    // --- Seed: a throwaway owner account for Business A -------------------------------
    const { data: created, error: createUserError } = await supabase.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
    });
    if (createUserError) throw new Error(`Failed to create owner account: ${createUserError.message}`);
    userId = created.user.id;

    const { error: membershipError } = await supabase
      .from("business_memberships")
      .insert({ user_id: userId, business_id: bizAId, role: "owner" });
    if (membershipError) throw new Error(`Failed to create business_membership: ${membershipError.message}`);

    // --- Act: sign in as Business A's owner, then trigger the real route -------------
    const loginRes = await fetch(`${DEV_SERVER_URL}/api/app/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
    });
    if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
    const cookieHeader = extractCookieHeader(loginRes);
    if (!cookieHeader) throw new Error("Login succeeded but no session cookie was returned.");

    const sendNowRes = await fetch(`${DEV_SERVER_URL}/api/app/reminders/send-now`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify({ contactId: contactAId }),
    });
    const sendNowBody = await sendNowRes.json();
    record("send-now route call succeeded", sendNowRes.ok && sendNowBody.ok === true, JSON.stringify(sendNowBody));

    // --- Assert: Business A's own reminder was actually processed --------------------
    const { data: reminderARow, error: reminderAReadError } = await supabase
      .from("reminders")
      .select("status")
      .eq("business_id", bizAId)
      .eq("contact_id", contactAId)
      .maybeSingle();
    if (reminderAReadError) throw new Error(`Failed to read Business A's reminder: ${reminderAReadError.message}`);
    record(
      "Business A's own reminder was claimed and processed (status moved off 'pending')",
      !!reminderARow && reminderARow.status !== "pending",
      `status=${reminderARow?.status}`,
    );

    // --- Assert: Business B's unrelated, already-due reminder was NOT touched --------
    const { data: reminderBRow, error: reminderBReadError } = await supabase
      .from("reminders")
      .select("status, locked_at")
      .eq("id", reminderBId)
      .single();
    if (reminderBReadError) throw new Error(`Failed to read Business B's reminder: ${reminderBReadError.message}`);
    record(
      "Business B's already-due reminder was left untouched by Business A's manual trigger",
      reminderBRow.status === "pending" && reminderBRow.locked_at === null,
      `status=${reminderBRow.status}, locked_at=${reminderBRow.locked_at}`,
    );
  } finally {
    // --- Cleanup: businesses cascade-delete contacts/reminders/messages/payments/identities ---
    if (bizAId || bizBId) {
      await supabase.from("businesses").delete().in("id", [bizAId, bizBId].filter(Boolean));
    }
    if (userId) {
      await supabase.from("business_memberships").delete().eq("user_id", userId);
      await supabase.auth.admin.deleteUser(userId);
    }
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    console.log("FAILED:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Script error:", error);
  process.exit(1);
});
