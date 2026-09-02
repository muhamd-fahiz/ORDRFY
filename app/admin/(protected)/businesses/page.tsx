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
    <div className="flex flex-col gap-6 lg:gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold sm:text-4xl lg:text-5xl">Businesses</h1>
        <Link
          href="/admin/businesses/new"
          className="inline-flex items-center justify-center rounded-lg bg-pink-strong px-6 py-3.5 font-app text-base font-semibold text-paper-raised transition-colors hover:bg-pink lg:px-7 lg:py-4 lg:text-lg"
        >
          New Business
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {(verticals ?? []).map((v) => (
          <Link
            key={v.key}
            href={`/admin/businesses/vertical/${v.key}`}
            className="flex flex-col gap-2 rounded-xl border border-ink-15 p-6 transition-colors hover:border-pink-strong lg:p-9"
          >
            <span className="font-app text-xl font-semibold text-ink lg:text-2xl">{v.label}</span>
            <span className="font-app text-base text-ink-40 lg:text-lg">
              {countByVertical.get(v.key) ?? 0} {countByVertical.get(v.key) === 1 ? "business" : "businesses"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
