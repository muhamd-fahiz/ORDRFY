import { NextResponse, type NextRequest } from "next/server";
import { createRlsClient } from "@/lib/db/server";
import { getRateLimiter } from "@/lib/rate-limit/factory";

// Same rate-limit shape as app/api/app/login/route.ts, own named buckets. Deliberately
// coarser than login's (a password-reset request is rarer, legitimate traffic than a login
// attempt) but still bounded, since this triggers an outbound email per request.
const ipLimiter = getRateLimiter("owner-forgot-password-ip", 5, 15 * 60);
const ipEmailLimiter = getRateLimiter("owner-forgot-password-ip-email", 3, 60 * 60);

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Always returns the same generic success response regardless of whether the email actually
 * matches an account -- Supabase's resetPasswordForEmail() is itself designed not to reveal
 * this, and this route must not undo that by branching on its result (user enumeration).
 */
export async function POST(request: NextRequest) {
  const { email } = (await request.json()) as { email?: string };
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const ip = getClientIp(request);

  const ipResult = await ipLimiter.check(`forgot-password-ip:${ip}`);
  if (!ipResult.success) {
    return NextResponse.json({ error: "Too many requests from this network. Try again later." }, { status: 429 });
  }
  const ipEmailResult = await ipEmailLimiter.check(`forgot-password-ip-email:${ip}:${email.toLowerCase()}`);
  if (!ipEmailResult.success) {
    return NextResponse.json({ error: "Too many requests for this account. Try again later." }, { status: 429 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const supabase = await createRlsClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/app/reset-password` });

  return NextResponse.json({ ok: true });
}
