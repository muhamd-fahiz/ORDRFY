import Link from "next/link";
import { createServiceRoleClient } from "@/lib/db/server";

/**
 * Landing page for the admin panel's business management: one card per vertical, not one
 * flat list mixing every business regardless of vertical -- per explicit instruction. Reads
 * `verticals` (ADR-0009) rather than a hardcoded list of the 5 names, so a future vertical
 * addition/deactivation needs no code change here.
 */
export default async function BusinessesLandingPage() {
  const supabase = createServiceRoleClient();

  const { data: verticals, error: verticalsError } = await supabase
    .from("verticals")
    .select("key, label")
    .eq("active", true)
    .order("key");
  if (verticalsError) {
    throw new Error(`Failed to load verticals: ${verticalsError.message}`);
  }

  const { data: businesses, error: businessesError } = await supabase
    .from("businesses")
    .select("vertical")
    .is("deleted_at", null);
  if (businessesError) {
    throw new Error(`Failed to load businesses: ${businessesError.message}`);
  }

  const countByVertical = new Map<string, number>();
  for (const b of businesses ?? []) {
    countByVertical.set(b.vertical, (countByVertical.get(b.vertical) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Businesses</h1>
        <Link
          href="/admin/businesses/new"
          className="inline-flex items-center justify-center rounded-lg bg-pink-strong px-4 py-2.5 font-app text-sm font-semibold text-paper-raised transition-colors hover:bg-pink"
        >
          New Business
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(verticals ?? []).map((v) => (
          <Link
            key={v.key}
            href={`/admin/businesses/vertical/${v.key}`}
            className="flex flex-col gap-1.5 rounded-lg border border-ink-15 p-4 transition-colors hover:border-pink-strong"
          >
            <span className="font-app text-base font-semibold text-ink">{v.label}</span>
            <span className="font-app text-sm text-ink-40">
              {countByVertical.get(v.key) ?? 0} {countByVertical.get(v.key) === 1 ? "business" : "businesses"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
