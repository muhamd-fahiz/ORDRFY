import { NextResponse, type NextRequest } from "next/server";
import { getAdminSessionState } from "@/lib/auth/admin-guard";
import { createRlsClient } from "@/lib/db/server";
import { getRateLimiter } from "@/lib/rate-limit/factory";

// Same shape as the login routes' own rate limiting -- this endpoint re-checks a password
// (the current one), which is exactly the kind of guessable action login rate limits exist
// for, just reached from an already-authenticated session instead of the login form.
const ipLimiter = getRateLimiter("admin-change-password-ip", 10, 5 * 60);

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Changing a password while already signed in still re-verifies the CURRENT password first
 * (via signInWithPassword, not just trusting the live session) -- deliberate extra friction
 * for this specific surface: an admin session reaches every tenant's data via the
 * service-role client, so the bar for "an unattended, unlocked browser tab can silently take
 * over this account" is set higher here than the owner app, which has no equivalent step.
 */
export async function POST(request: NextRequest) {
  const state = await getAdminSessionState();
  if (state.status !== "ready") {
    return NextResponse.json({ error: "Not signed in as an admin." }, { status: 401 });
  }

  const ipResult = await ipLimiter.check(`admin-change-password-ip:${getClientIp(request)}`);
  if (!ipResult.success) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const { currentPassword, newPassword } = (await request.json()) as {
    currentPassword?: string;
    newPassword?: string;
  };
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current and new password are required." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  const supabase = await createRlsClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Could not resolve the current session's email." }, { status: 401 });
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
