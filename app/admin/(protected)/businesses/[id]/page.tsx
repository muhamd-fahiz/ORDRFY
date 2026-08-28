import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/db/server";

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data: business, error } = await supabase
    .from("businesses")
    .select(
      "id, name, phone, email, vertical, subscription_status, trial_ends_at, timezone, preferred_language, automation_paused, created_at, deleted_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load business: ${error.message}`);
  }
  if (!business) {
    notFound();
  }

  const { data: connections } = await supabase
    .from("business_channel_connections")
    .select("channel_id, provider_account_id, connected, disconnected_at, current_tier, channels(name)")
    .eq("business_id", id);

  const { data: entitlements } = await supabase
    .from("business_entitlements")
    .select("entitlement_key, active")
    .eq("business_id", id);

  const { data: memberships } = await supabase
    .from("business_memberships")
    .select("user_id, role, created_at")
    .eq("business_id", id);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold">{business.name}</h1>
        {business.deleted_at && (
          <span className="rounded bg-status-overdue/10 px-1.5 py-0.5 text-xs text-status-overdue">
            deleted at {new Date(business.deleted_at).toLocaleString()}
          </span>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-500">Business Info</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-neutral-500">Vertical</dt>
          <dd className="capitalize">{business.vertical}</dd>
          <dt className="text-neutral-500">Subscription status</dt>
          <dd className="capitalize">{business.subscription_status}</dd>
          <dt className="text-neutral-500">Trial ends</dt>
          <dd>{business.trial_ends_at ? new Date(business.trial_ends_at).toLocaleDateString() : "—"}</dd>
          <dt className="text-neutral-500">Phone</dt>
          <dd>{business.phone ?? "—"}</dd>
          <dt className="text-neutral-500">Email</dt>
          <dd>{business.email ?? "—"}</dd>
          <dt className="text-neutral-500">Timezone</dt>
          <dd>{business.timezone}</dd>
          <dt className="text-neutral-500">Preferred language</dt>
          <dd>{business.preferred_language}</dd>
          <dt className="text-neutral-500">Kill switch (automation_paused)</dt>
          <dd>{business.automation_paused ? "PAUSED" : "active"}</dd>
          <dt className="text-neutral-500">Created</dt>
          <dd>{new Date(business.created_at).toLocaleString()}</dd>
        </dl>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-500">Channel Connections</h2>
        {!connections || connections.length === 0 ? (
          <p className="text-sm text-neutral-500">No channels connected yet.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="py-1 pr-4">Channel</th>
                <th className="py-1 pr-4">Connected</th>
                <th className="py-1 pr-4">Provider account</th>
                <th className="py-1 pr-4">Tier</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((c) => (
                <tr key={c.channel_id} className="border-b border-neutral-100">
                  <td className="py-1 pr-4 capitalize">{c.channels?.name}</td>
                  <td className="py-1 pr-4">{c.connected ? "yes" : "no"}</td>
                  <td className="py-1 pr-4">{c.provider_account_id ?? "—"}</td>
                  <td className="py-1 pr-4">{c.current_tier ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-500">Entitlements</h2>
        {!entitlements || entitlements.length === 0 ? (
          <p className="text-sm text-neutral-500">No entitlements assigned yet.</p>
        ) : (
          <ul className="text-sm">
            {entitlements.map((e) => (
              <li key={e.entitlement_key}>
                {e.entitlement_key} — {e.active ? "active" : "inactive"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-500">Owner Members</h2>
        {!memberships || memberships.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No owner account created yet. (Owner account creation/invite flow is not built in this
            skeleton pass.)
          </p>
        ) : (
          <ul className="text-sm">
            {memberships.map((m) => (
              <li key={m.user_id}>
                {m.user_id} — {m.role}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
