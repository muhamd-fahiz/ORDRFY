import { createServiceRoleClient } from "@/lib/db/server";
import { SubscriptionsList } from "./subscriptions-list";

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

  const rows = businesses.map((b) => ({
    id: b.id,
    name: b.name,
    vertical: b.vertical,
    subscriptionStatus: b.subscription_status,
    trialEndsAt: b.trial_ends_at ? new Date(b.trial_ends_at).toLocaleDateString() : null,
  }));

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <h1 className="font-display text-3xl font-bold sm:text-4xl lg:text-5xl">Subscriptions</h1>
      <p className="font-app text-base text-ink-40 lg:text-lg">
        Subscription pricing isn&apos;t finalized yet (same &ldquo;₹—&rdquo; placeholder as the marketing site) — this
        shows each business&apos;s status only, not a billed amount.
      </p>
      <SubscriptionsList subscriptions={rows} />
    </div>
  );
}
