import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/db/server";
import { Chip } from "@/components/ui/Chip";
import { CreateOwnerForm } from "./create-owner-form";

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

  // business_memberships only stores user_id -- look up each member's email for display via
  // the admin auth API (service-role only; never exposed to a non-admin caller).
  const membershipsWithEmail = await Promise.all(
    (memberships ?? []).map(async (m) => {
      const { data } = await supabase.auth.admin.getUserById(m.user_id);
      return { ...m, email: data.user?.email ?? "(unknown)" };
    }),
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 font-app lg:gap-10">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl lg:text-5xl">{business.name}</h1>
        {business.deleted_at && (
          <Chip tone="attention">deleted at {new Date(business.deleted_at).toLocaleString()}</Chip>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        <section className="rounded-xl border border-ink-15 p-6 lg:p-9">
          <h2 className="mb-4 text-base font-semibold uppercase tracking-wide text-ink-40">Business Info</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-lg text-ink">
            <dt className="text-ink-40">Vertical</dt>
            <dd className="capitalize">{business.vertical}</dd>
            <dt className="text-ink-40">Subscription status</dt>
            <dd className="capitalize">{business.subscription_status}</dd>
            <dt className="text-ink-40">Trial ends</dt>
            <dd>{business.trial_ends_at ? new Date(business.trial_ends_at).toLocaleDateString() : "—"}</dd>
            <dt className="text-ink-40">Phone</dt>
            <dd>{business.phone ?? "—"}</dd>
            <dt className="text-ink-40">Email</dt>
            <dd>{business.email ?? "—"}</dd>
            <dt className="text-ink-40">Timezone</dt>
            <dd>{business.timezone}</dd>
            <dt className="text-ink-40">Preferred language</dt>
            <dd>{business.preferred_language}</dd>
            <dt className="text-ink-40">Kill switch</dt>
            <dd>
              <Chip tone={business.automation_paused ? "attention" : "confirmed"}>
                {business.automation_paused ? "PAUSED" : "active"}
              </Chip>
            </dd>
            <dt className="text-ink-40">Created</dt>
            <dd>{new Date(business.created_at).toLocaleString()}</dd>
          </dl>
        </section>

        <section className="rounded-xl border border-ink-15 p-6 lg:p-9">
          <h2 className="mb-4 text-base font-semibold uppercase tracking-wide text-ink-40">Channel Connections</h2>
          {!connections || connections.length === 0 ? (
            <p className="text-lg text-ink-70">No channels connected yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-lg text-ink">
                <thead>
                  <tr className="border-b border-ink-15 text-left text-ink-40">
                    <th className="py-3 pr-6">Channel</th>
                    <th className="py-3 pr-6">Connected</th>
                    <th className="py-3 pr-6">Provider account</th>
                    <th className="py-3 pr-6">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {connections.map((c) => (
                    <tr key={c.channel_id} className="border-b border-ink-15">
                      <td className="py-3 pr-6 capitalize">{c.channels?.name}</td>
                      <td className="py-3 pr-6">{c.connected ? "yes" : "no"}</td>
                      <td className="py-3 pr-6">{c.provider_account_id ?? "—"}</td>
                      <td className="py-3 pr-6">{c.current_tier ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-ink-15 p-6 lg:p-9">
          <h2 className="mb-4 text-base font-semibold uppercase tracking-wide text-ink-40">Entitlements</h2>
          {!entitlements || entitlements.length === 0 ? (
            <p className="text-lg text-ink-70">No entitlements assigned yet.</p>
          ) : (
            <ul className="text-lg text-ink">
              {entitlements.map((e) => (
                <li key={e.entitlement_key}>
                  {e.entitlement_key} — {e.active ? "active" : "inactive"}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-ink-15 p-6 lg:p-9">
          <h2 className="mb-4 text-base font-semibold uppercase tracking-wide text-ink-40">Owner Members</h2>
          {membershipsWithEmail.length === 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-lg text-ink-70">No owner account created yet.</p>
              <CreateOwnerForm businessId={id} defaultEmail={business.email ?? ""} />
            </div>
          ) : (
            <ul className="text-lg text-ink">
              {membershipsWithEmail.map((m) => (
                <li key={m.user_id}>
                  {m.email} — {m.role}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
