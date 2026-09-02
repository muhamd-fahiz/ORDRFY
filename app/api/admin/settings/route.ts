import { NextResponse, type NextRequest } from "next/server";
import { getAdminSessionState } from "@/lib/auth/admin-guard";
import { createServiceRoleClient } from "@/lib/db/server";

/**
 * Updates the signed-in admin's own admin_users.name only -- admin_users' RLS policy is
 * select-only for the owning row (users_see_own_admin_row), by design (see that table's own
 * comment: admin authorization lives in application code, not a Postgres policy), so this
 * write goes through the service-role client after re-verifying the session server-side,
 * matching every other admin API route's pattern.
 */
export async function POST(request: NextRequest) {
  const state = await getAdminSessionState();
  if (state.status !== "ready") {
    return NextResponse.json({ error: "Not signed in as an admin." }, { status: 401 });
  }

  const { name } = (await request.json()) as { name?: string };
  const trimmedName = name?.trim();
  if (!trimmedName) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("admin_users").update({ name: trimmedName }).eq("user_id", state.userId);
  if (error) {
    return NextResponse.json({ error: `Could not save: ${error.message}` }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
