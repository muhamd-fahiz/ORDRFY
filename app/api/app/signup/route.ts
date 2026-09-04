import { NextResponse, type NextRequest } from "next/server";
import { createRlsClient } from "@/lib/db/server";
import { getRateLimiter } from "@/lib/rate-limit/factory";

// Own named buckets, deliberately coarser than login's (ADR-0040): a signup request is
// rarer legitimate traffic than a login attempt, but creates a real auth.users row and
// triggers an outbound email, same shape as forgot-password's own reasoning for being
// coarser than login.
const ipLimiter = getRateLimiter("owner-signup-ip", 5, 15 * 60);
const ipEmailLimiter = getRateLimiter("owner-signup-ip-email", 3, 60 * 60);

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
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const ip = getClientIp(request);

  const ipResult = await ipLimiter.check(`signup-ip:${ip}`);
  if (!ipResult.success) {
    return NextResponse.json({ error: "Too many signup attempts from this network. Try again later." }, { status: 429 });
  }
  const ipEmailResult = await ipEmailLimiter.check(`signup-ip-email:${ip}:${email.toLowerCase()}`);
  if (!ipEmailResult.success) {
    return NextResponse.json({ error: "Too many signup attempts for this address. Try again later." }, { status: 429 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const supabase = await createRlsClient();

  // enable_confirmations = true for this project's [auth.email] config means this always
  // requires clicking the emailed confirmation link before a real session exists -- unlike
  // the admin-provisioned path (create-owner/route.ts), which sets email_confirm: true
  // explicitly at creation and is entirely unaffected by this global setting.
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/app/signup/confirmed` },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
