import Link from "next/link";
import { createServiceRoleClient } from "@/lib/db/server";
import { Chip } from "@/components/ui/Chip";

export default async function BusinessesListPage() {
  const supabase = createServiceRoleClient();

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select(
      "id, name, vertical, subscription_status, preferred_language, created_at, deleted_at, business_channel_connections(channel_id, connected, channels(name))",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load businesses: ${error.message}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-lg font-bold">Businesses</h1>
        <Link
          href="/admin/businesses/new"
          className="inline-flex items-center justify-center rounded-lg bg-pink-strong px-4 py-2 font-app text-sm font-semibold text-paper-raised transition-colors hover:bg-pink"
        >
          New Business
        </Link>
      </div>

      {businesses.length === 0 ? (
        <p className="font-app text-sm text-ink-70">No businesses yet. Create the first one.</p>
      ) : (
        <table className="w-full border-collapse font-app text-sm">
          <thead>
            <tr className="border-b border-ink-15 text-left text-ink-40">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Vertical</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Channels connected</th>
              <th className="py-2 pr-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id} className="border-b border-ink-15">
                <td className="py-2 pr-4">
                  <Link href={`/admin/businesses/${b.id}`} className="font-semibold text-pink-strong hover:underline">
                    {b.name}
                  </Link>
                  {b.deleted_at && (
                    <span className="ml-2">
                      <Chip tone="attention">deleted</Chip>
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 capitalize">{b.vertical}</td>
                <td className="py-2 pr-4 capitalize">{b.subscription_status}</td>
                <td className="py-2 pr-4">
                  {b.business_channel_connections.filter((c) => c.connected).length > 0
                    ? b.business_channel_connections
                        .filter((c) => c.connected)
                        .map((c) => c.channels?.name)
                        .join(", ")
                    : "none"}
                </td>
                <td className="py-2 pr-4 text-ink-40">{new Date(b.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
