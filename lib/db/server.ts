import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * RLS-scoped client for use inside Server Components / Route Handlers on behalf of the
 * currently authenticated user. Every query through this client is subject to the RLS
 * policies defined in supabase/migrations -- this is the ONLY client that should ever
 * handle a business owner's request.
 */
export async function createRlsClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component during render -- middleware refreshes the
            // session instead. Safe to ignore.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. Bypasses RLS entirely. NEVER import this file from a Client
 * Component or anywhere that could end up in a browser bundle -- the "no service-role
 * secret in browser" check in CI (Ordrfy-Hardening-Addendum.pdf Section 3) exists
 * specifically to catch that mistake.
 *
 * Only two categories of caller may use this: (1) admin panel API routes, after verifying
 * the requester against admin_users, and (2) webhook/cron routes, which run as trusted
 * server code and often need to resolve a business_id before any RLS-scoped query is even
 * possible (Ordrfy-Final-Architecture.pdf Section 4).
 */
export function createServiceRoleClient() {
  if (typeof window !== "undefined") {
    throw new Error("createServiceRoleClient() must never be called from client code.");
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    },
  );
}
