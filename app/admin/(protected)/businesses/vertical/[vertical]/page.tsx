import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/db/server";
import { VerticalBusinessesList } from "./businesses-list";

export default async function VerticalBusinessesPage({
  params,
}: {
  params: Promise<{ vertical: string }>;
}) {
  const { vertical } = await params;
  const supabase = createServiceRoleClient();

  const { data: verticalRow, error: verticalError } = await supabase
    .from("verticals")
    .select("key, label")
    .eq("key", vertical)
    .maybeSingle();
  if (verticalError) {
    throw new Error(`Failed to load vertical: ${verticalError.message}`);
  }
  if (!verticalRow) {
    notFound();
  }

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select(
      "id, name, subscription_status, created_at, deleted_at, business_channel_connections(channel_id, connected, channels(name))",
    )
    .eq("vertical", vertical)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Failed to load businesses: ${error.message}`);
  }

  // formatted here, on the server, not inside the client search component -- same reasoning
  // as the owner app's Contacts List: Date formatting reads the clock, and doing it in a
  // client component would re-run during hydration on the browser's own clock instead.
  const rows = businesses.map((b) => ({
    id: b.id,
    name: b.name,
    subscriptionStatus: b.subscription_status,
    deletedAt: b.deleted_at,
    createdAt: new Date(b.created_at).toLocaleDateString(),
    connectedChannels:
      b.business_channel_connections.filter((c) => c.connected).length > 0
        ? b.business_channel_connections
            .filter((c) => c.connected)
            .map((c) => c.channels?.name)
            .join(", ")
        : "none",
  }));

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin/businesses" className="inline-block font-app text-sm text-ink-40 underline">
        &larr; All verticals
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{verticalRow.label}</h1>
        <Link
          href="/admin/businesses/new"
          className="inline-flex items-center justify-center rounded-lg bg-pink-strong px-4 py-2.5 font-app text-sm font-semibold text-paper-raised transition-colors hover:bg-pink"
        >
          New Business
        </Link>
      </div>

      <VerticalBusinessesList businesses={rows} />
    </div>
  );
}
