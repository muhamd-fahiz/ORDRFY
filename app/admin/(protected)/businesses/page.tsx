import Link from "next/link";
import { createServiceRoleClient } from "@/lib/db/server";

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
        <h1 className="text-lg font-semibold">Businesses</h1>
        <Link
          href="/admin/businesses/new"
          className="rounded bg-brand px-3 py-2 text-sm font-medium text-brand-foreground"
        >
          New Business
        </Link>
      </div>

      {businesses.length === 0 ? (
        <p className="text-sm text-neutral-500">No businesses yet. Create the first one.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Vertical</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Channels connected</th>
              <th className="py-2 pr-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id} className="border-b border-neutral-100">
                <td className="py-2 pr-4">
                  <Link href={`/admin/businesses/${b.id}`} className="font-medium text-brand hover:underline">
                    {b.name}
                  </Link>
                  {b.deleted_at && (
                    <span className="ml-2 rounded bg-status-overdue/10 px-1.5 py-0.5 text-xs text-status-overdue">
                      deleted
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
                <td className="py-2 pr-4 text-neutral-500">
                  {new Date(b.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
