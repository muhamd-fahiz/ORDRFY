import { createServiceRoleClient } from "@/lib/db/server";
import { formatRupees } from "@/lib/design/format-currency";
import { BarList } from "./bar-list";

const SUBSCRIPTION_AMOUNT_SETTING_KEY = "subscription_amount_inr";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-ink-15 p-5 lg:p-6">
      <div className="font-app text-sm font-semibold uppercase tracking-wide text-ink-40">{label}</div>
      <div className="mt-2 font-data text-3xl font-bold text-ink lg:text-4xl">{value}</div>
      {hint && <div className="mt-1 font-app text-sm text-ink-40">{hint}</div>}
    </div>
  );
}

/**
 * "My customers" here means Ordrfy's own customers -- the businesses themselves -- never
 * the businesses' own end-customers. Deliberately does not touch contacts/messages/payments
 * (those tables are about a business's own customers, not Ordrfy's relationship to the
 * business) -- corrected after building the wrong thing once already (see ADR-0034's
 * revision history / this session's own correction). Every number here comes from
 * businesses + business_settings only.
 */
export default async function AdminDashboardPage() {
  const supabase = createServiceRoleClient();

  const [{ data: businesses, error: businessesError }, { data: amountSettings, error: amountError }] = await Promise.all([
    supabase.from("businesses").select("id, vertical, subscription_status").is("deleted_at", null),
    supabase.from("business_settings").select("business_id, setting_value").eq("setting_key", SUBSCRIPTION_AMOUNT_SETTING_KEY),
  ]);
  if (businessesError) throw new Error(`Failed to load businesses: ${businessesError.message}`);
  if (amountError) throw new Error(`Failed to load subscription amounts: ${amountError.message}`);

  const { data: verticals, error: verticalsError } = await supabase
    .from("verticals")
    .select("key, label")
    .eq("active", true)
    .order("key");
  if (verticalsError) throw new Error(`Failed to load verticals: ${verticalsError.message}`);

  const amountByBusinessId = new Map((amountSettings ?? []).map((s) => [s.business_id, Number(s.setting_value)]));

  const totalBusinesses = businesses.length;
  const activeCount = businesses.filter((b) => b.subscription_status === "active").length;
  const trialCount = businesses.filter((b) => b.subscription_status === "trial").length;
  const totalSubscriptionRevenue = [...amountByBusinessId.values()].reduce((sum, v) => sum + v, 0);
  const businessesWithoutAmount = totalBusinesses - amountByBusinessId.size;

  const businessCountByVertical = new Map<string, number>();
  const revenueByVertical = new Map<string, number>();
  for (const b of businesses) {
    businessCountByVertical.set(b.vertical, (businessCountByVertical.get(b.vertical) ?? 0) + 1);
    const amount = amountByBusinessId.get(b.id) ?? 0;
    revenueByVertical.set(b.vertical, (revenueByVertical.get(b.vertical) ?? 0) + amount);
  }

  const businessesByVerticalChart = (verticals ?? [])
    .map((v) => ({ label: v.label, value: businessCountByVertical.get(v.key) ?? 0 }))
    .sort((a, b) => b.value - a.value);

  const revenueByVerticalChart = (verticals ?? [])
    .map((v) => ({ label: v.label, value: revenueByVertical.get(v.key) ?? 0 }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <h1 className="font-display text-3xl font-bold sm:text-4xl lg:text-5xl">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Businesses" value={String(totalBusinesses)} />
        <StatCard label="Active" value={String(activeCount)} />
        <StatCard label="Trial" value={String(trialCount)} />
        <StatCard label="Subscription revenue" value={formatRupees(totalSubscriptionRevenue)} hint="manually tracked" />
      </div>

      {businessesWithoutAmount > 0 && (
        <p className="font-app text-base text-ink-40 lg:text-lg">
          {businessesWithoutAmount} of {totalBusinesses} business(es) have no subscription amount set yet (Subscriptions tab).
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        <BarList
          title="Businesses by vertical"
          items={businessesByVerticalChart}
          formatValue={(n) => String(n)}
          emptyLabel="No businesses yet."
        />
        <BarList
          title="Subscription revenue by vertical"
          items={revenueByVerticalChart}
          formatValue={(n) => formatRupees(n)}
          emptyLabel="No subscription amounts set yet."
        />
      </div>
    </div>
  );
}
