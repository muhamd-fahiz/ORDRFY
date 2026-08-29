import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSessionState } from "@/lib/auth/admin-guard";
import { createServiceRoleClient } from "@/lib/db/server";

/**
 * Closes CLAUDE.md known blocker #10: there was no way to create a business owner's login.
 * Deliberately admin-provisioned, not self-service (self-service signup is explicitly out
 * of V1 scope) -- an admin creates the auth.users row directly with a generated password,
 * the same way scripts/create-admin.mjs bootstraps an admin account, except triggered from
 * the admin panel UI (by an admin, not a developer with server/CLI access) since that's who
 * actually needs to do this in practice.
 *
 * The generated password is returned ONCE in this response and is never stored in
 * plaintext anywhere (not logged, not in activity_log) -- the admin is expected to relay it
 * to the business owner out of band (phone/WhatsApp), consistent with these businesses
 * being WhatsApp-first, not necessarily email-checking.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // requireReadyAdminSession() calls next/navigation's redirect(), which is correct for a
  // page but not a route handler: fetch() transparently follows the resulting 307 rather
  // than surfacing a clean error, so a signed-out client-side caller here would try to
  // JSON-parse the login page's HTML and throw on that instead of seeing a 401. Route
  // handlers under app/api/ check the non-redirecting state directly instead.
  const state = await getAdminSessionState();
  if (state.status !== "ready") {
    return NextResponse.json({ error: "Not signed in as an admin." }, { status: 401 });
  }
  const session = state;
  const { id: businessId } = await params;

  const { email } = (await request.json()) as { email?: string };
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .maybeSingle();
  if (businessError) {
    return NextResponse.json({ error: `Failed to load business: ${businessError.message}` }, { status: 500 });
  }
  if (!business) {
    return NextResponse.json({ error: "Business not found." }, { status: 404 });
  }

  const { data: existingMemberships, error: membershipCheckError } = await supabase
    .from("business_memberships")
    .select("id")
    .eq("business_id", businessId)
    .limit(1);
  if (membershipCheckError) {
    return NextResponse.json({ error: `Failed to check memberships: ${membershipCheckError.message}` }, { status: 500 });
  }
  if (existingMemberships && existingMemberships.length > 0) {
    return NextResponse.json({ error: "This business already has an owner account." }, { status: 409 });
  }

  const temporaryPassword = randomBytes(12).toString("base64url");

  const { data: created, error: createUserError } = await supabase.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
  });
  if (createUserError) {
    return NextResponse.json({ error: `Failed to create login: ${createUserError.message}` }, { status: 500 });
  }

  const { error: membershipError } = await supabase
    .from("business_memberships")
    .insert({ user_id: created.user.id, business_id: businessId, role: "owner" });
  if (membershipError) {
    // Roll back the orphaned auth user rather than leaving a login with no business access.
    await supabase.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: `Failed to link owner to business: ${membershipError.message}` }, { status: 500 });
  }

  await supabase.from("activity_log").insert({
    business_id: businessId,
    event_type: "owner_account_created",
    event_detail: { email },
    actor_user_id: session.userId,
  });

  return NextResponse.json({ ok: true, email, temporaryPassword });
}
