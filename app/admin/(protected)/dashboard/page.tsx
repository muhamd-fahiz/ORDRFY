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

export default async function AdminDashboardPage() {
  const supabase = createServiceRoleClient();

  const [{ data: businesses, error: businessesError }, { data: contacts, error: contactsError }, { data: payments, error: paymentsError }, { data: amountSettings, error: amountError }, { count: unresolvedAttentionCount, error: attentionError }] =
    await Promise.all([
      supabase.from("businesses").select("id, name, vertical, subscription_status").is("deleted_at", null),
      supabase.from("contacts").select("business_id"),
      supabase.from("payments").select("business_id, amount_paid"),
      supabase.from("business_settings").select("business_id, setting_value").eq("setting_key", SUBSCRIPTION_AMOUNT_SETTING_KEY),
      supabase.from("owner_attention_queue").select("id", { count: "exact", head: true }).is("resolved_at", null),
    ]);

  if (businessesError) throw new Error(`Failed to load businesses: ${businessesError.message}`);
  if (contactsError) throw new Error(`Failed to load contacts: ${contactsError.message}`);
  if (paymentsError) throw new Error(`Failed to load payments: ${paymentsError.message}`);
  if (amountError) throw new Error(`Failed to load subscription amounts: ${amountError.message}`);
  if (attentionError) throw new Error(`Failed to load attention queue: ${attentionError.message}`);

  const contactCountByBusiness = new Map<string, number>();
  for (const c of contacts ?? []) {
    contactCountByBusiness.set(c.business_id, (contactCountByBusiness.get(c.business_id) ?? 0) + 1);
  }

  const paidByBusiness = new Map<string, number>();
  for (const p of payments ?? []) {
    paidByBusiness.set(p.business_id, (paidByBusiness.get(p.business_id) ?? 0) + Number(p.amount_paid));
  }

  const subscriptionAmountByBusiness = new Map<string, number>();
  for (const s of amountSettings ?? []) {
    subscriptionAmountByBusiness.set(s.business_id, Number(s.setting_value));
  }

  const totalBusinesses = businesses.length;
  const activeCount = businesses.filter((b) => b.subscription_status === "active").length;
  const trialCount = businesses.filter((b) => b.subscription_status === "trial").length;
  const totalCustomers = contacts?.length ?? 0;
  const totalOrderValueTracked = [...paidByBusiness.values()].reduce((sum, v) => sum + v, 0);
  const totalManualSubscriptionRevenue = [...subscriptionAmountByBusiness.values()].reduce((sum, v) => sum + v, 0);

  const customersByBusiness = businesses
    .map((b) => ({ label: b.name, value: contactCountByBusiness.get(b.id) ?? 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const orderValueByBusiness = businesses
    .map((b) => ({ label: b.name, value: paidByBusiness.get(b.id) ?? 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <h1 className="font-display text-3xl font-bold sm:text-4xl lg:text-5xl">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Businesses" value={String(totalBusinesses)} />
        <StatCard label="Active" value={String(activeCount)} />
        <StatCard label="Trial" value={String(trialCount)} />
        <StatCard label="Customers" value={String(totalCustomers)} hint="across all businesses" />
        <StatCard label="Order value tracked" value={formatRupees(totalOrderValueTracked)} hint="sum of payments.amount_paid" />
        <StatCard label="Needs attention" value={String(unresolvedAttentionCount ?? 0)} hint="unresolved, all businesses" />
      </div>

      <div className="rounded-xl border border-ink-15 bg-ink-15/20 p-5 font-app text-base text-ink-70 lg:p-6 lg:text-lg">
        Manually-tracked subscription revenue (Subscriptions tab, not a real invoice):{" "}
        <span className="font-data font-bold text-ink">{formatRupees(totalManualSubscriptionRevenue)}</span>
        {subscriptionAmountByBusiness.size < totalBusinesses && (
          <span className="text-ink-40"> — {totalBusinesses - subscriptionAmountByBusiness.size} business(es) have no amount set yet.</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        <BarList
          title="Most customers by business"
          items={customersByBusiness}
          formatValue={(n) => String(n)}
          emptyLabel="No customers yet."
        />
        <BarList
          title="Most order value by business"
          items={orderValueByBusiness}
          formatValue={(n) => formatRupees(n)}
          emptyLabel="No payments recorded yet."
        />
      </div>
    </div>
  );
}
