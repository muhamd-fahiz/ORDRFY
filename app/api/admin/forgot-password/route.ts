import { NextResponse, type NextRequest } from "next/server";
import { createRlsClient } from "@/lib/db/server";
import { getRateLimiter } from "@/lib/rate-limit/factory";

// Same shape as app/api/app/forgot-password/route.ts, own named buckets so the two surfaces
// never share a rate-limit budget (mirrors the existing login-route pattern).
const ipLimiter = getRateLimiter("admin-forgot-password-ip", 5, 15 * 60);
const ipEmailLimiter = getRateLimiter("admin-forgot-password-ip-email", 3, 60 * 60);

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Always returns the same generic success response regardless of whether the email actually
 * matches an account (let alone an admin one) -- no branching on that here, same
 * anti-enumeration reasoning as the owner-app route.
 */
export async function POST(request: NextRequest) {
  const { email } = (await request.json()) as { email?: string };
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const ip = getClientIp(request);

  const ipResult = await ipLimiter.check(`admin-forgot-password-ip:${ip}`);
  if (!ipResult.success) {
    return NextResponse.json({ error: "Too many requests from this network. Try again later." }, { status: 429 });
  }
  const ipEmailResult = await ipEmailLimiter.check(`admin-forgot-password-ip-email:${ip}:${email.toLowerCase()}`);
  if (!ipEmailResult.success) {
    return NextResponse.json({ error: "Too many requests for this account. Try again later." }, { status: 429 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const supabase = await createRlsClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/admin/reset-password` });

  return NextResponse.json({ ok: true });
}
