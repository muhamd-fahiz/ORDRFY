import { createServiceRoleClient } from "@/lib/db/server";
import { SubscriptionsList } from "./subscriptions-list";

const SUBSCRIPTION_AMOUNT_SETTING_KEY = "subscription_amount_inr";

export default async function SubscriptionsPage() {
  const supabase = createServiceRoleClient();

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("id, name, vertical, subscription_status, trial_ends_at")
    .is("deleted_at", null)
    .order("name");
  if (error) {
    throw new Error(`Failed to load businesses: ${error.message}`);
  }

  const { data: amountSettings, error: amountError } = await supabase
    .from("business_settings")
    .select("business_id, setting_value")
    .eq("setting_key", SUBSCRIPTION_AMOUNT_SETTING_KEY);
  if (amountError) {
    throw new Error(`Failed to load subscription amounts: ${amountError.message}`);
  }
  const amountByBusinessId = new Map((amountSettings ?? []).map((s) => [s.business_id, Number(s.setting_value)]));

  const rows = businesses.map((b) => ({
    id: b.id,
    name: b.name,
    vertical: b.vertical,
    subscriptionStatus: b.subscription_status,
    trialEndsAt: b.trial_ends_at ? new Date(b.trial_ends_at).toLocaleDateString() : null,
    monthlyAmount: amountByBusinessId.get(b.id) ?? null,
  }));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Subscriptions</h1>
      <p className="font-app text-sm text-ink-40">
        There&apos;s no finalized company-wide pricing yet, so amounts here are whatever you&apos;ve manually set per
        business — not a real invoice or payment history. Click an amount to set or change it.
      </p>
      <SubscriptionsList subscriptions={rows} />
    </div>
  );
}
