import { NextResponse, type NextRequest } from "next/server";
import { createRlsClient } from "@/lib/db/server";
import { getRateLimiter } from "@/lib/rate-limit/factory";
import { getOwnerSessionState } from "@/lib/auth/owner-guard";

// Same hardening shape as app/api/admin/login/route.ts, with its own named buckets so the
// two surfaces' login attempts never share (or contend for) a rate-limit budget.
const ipLimiter = getRateLimiter("owner-login-ip", 10, 5 * 60);
const ipEmailLimiter = getRateLimiter("owner-login-ip-email", 5, 15 * 60);

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  const { email, password } = (await request.json()) as { email?: string; password?: string };

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const ip = getClientIp(request);

  const ipResult = await ipLimiter.check(`login-ip:${ip}`);
  if (!ipResult.success) {
    return NextResponse.json(
      { error: "Too many login attempts from this network. Try again later." },
      { status: 429 },
    );
  }

  const ipEmailResult = await ipEmailLimiter.check(`login-ip-email:${ip}:${email.toLowerCase()}`);
  if (!ipEmailResult.success) {
    return NextResponse.json(
      { error: "Too many login attempts for this account. Try again later." },
      { status: 429 },
    );
  }

  const supabase = await createRlsClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  // Computed here, server-side, rather than the client hardcoding /app/today (ADR-0040):
  // a self-service account mid-onboarding must land on /onboarding, never on a dashboard
  // it has no membership for. An account with neither a membership nor a draft is now
  // ALSO routed to onboarding (Phase 5 hardening) -- that covers both a fresh signup and a
  // returning owner whose draft expired after 14 days, neither of which should hit a dead
  // end here. Only a genuine admin account (positive admin_users check, never a heuristic)
  // still gets the error, matching the exact copy the protected layout's own
  // ?error=no_membership banner already shows -- delivered inline instead of via a
  // redirect round-trip, and the session is signed back out either way.
  const state = await getOwnerSessionState();
  if (state.status === "no_membership_admin_account") {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "That account isn't linked to a business yet. Contact Ordrfy support." },
      { status: 403 },
    );
  }

  const redirectTo = state.status === "ready" ? "/app/today" : "/onboarding";
  return NextResponse.json({ ok: true, redirectTo });
}
