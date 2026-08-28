import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/**
 * Host-aware on purpose: today ordrfy.in/app.ordrfy.in/admin.ordrfy.in are all one Next.js
 * app (no subdomain split yet), so a plain static robots.txt can't tell "admin" traffic
 * from anything else. Checking the request Host header means this file needs zero changes
 * once production deployment actually splits admin.ordrfy.in onto its own host -- it will
 * correctly start serving a full disallow-all robots.txt for that host the moment the DNS/
 * routing split exists, with no code change required.
 *
 * This is a defense-in-depth layer only -- the actual security boundary is admin_users
 * membership + MFA (lib/auth/admin-guard.ts), never "the URL is hard to find."
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") ?? "";

  if (host.startsWith("admin.")) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: { userAgent: "*", disallow: "/admin" },
  };
}
