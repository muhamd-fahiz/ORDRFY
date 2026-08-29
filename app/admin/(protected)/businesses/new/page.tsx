import { createRlsClient } from "@/lib/db/server";
import { Button } from "@/components/ui/Button";
import { createBusiness } from "./actions";

export default async function NewBusinessPage() {
  const supabase = await createRlsClient();
  const { data: verticals, error } = await supabase
    .from("verticals")
    .select("key, label")
    .eq("active", true)
    .order("label");

  if (error) {
    throw new Error(`Failed to load verticals: ${error.message}`);
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <h1 className="font-display text-lg font-bold">New Business</h1>
      <form action={createBusiness} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 font-app text-sm text-ink-70">
          Business name
          <input name="name" required className="rounded-lg border border-ink-15 px-3 py-2 font-app text-ink" />
        </label>

        <label className="flex flex-col gap-1 font-app text-sm text-ink-70">
          Vertical
          <select name="vertical" required className="rounded-lg border border-ink-15 px-3 py-2 font-app text-ink">
            <option value="">Select a vertical...</option>
            {verticals.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 font-app text-sm text-ink-70">
          Phone
          <input name="phone" className="rounded-lg border border-ink-15 px-3 py-2 font-app text-ink" />
        </label>

        <label className="flex flex-col gap-1 font-app text-sm text-ink-70">
          Email
          <input name="email" type="email" className="rounded-lg border border-ink-15 px-3 py-2 font-app text-ink" />
        </label>

        <label className="flex flex-col gap-1 font-app text-sm text-ink-70">
          Timezone
          <input
            name="timezone"
            defaultValue="Asia/Kolkata"
            className="rounded-lg border border-ink-15 px-3 py-2 font-app text-ink"
          />
        </label>

        <label className="flex flex-col gap-1 font-app text-sm text-ink-70">
          Preferred language
          <input
            name="preferred_language"
            defaultValue="en"
            className="rounded-lg border border-ink-15 px-3 py-2 font-app text-ink"
          />
        </label>

        <label className="flex flex-col gap-1 font-app text-sm text-ink-70">
          Subscription status
          <select
            name="subscription_status"
            defaultValue="trial"
            className="rounded-lg border border-ink-15 px-3 py-2 font-app text-ink"
          >
            <option value="trial">Trial</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <Button type="submit" className="mt-2 w-fit">
          Create Business
        </Button>
      </form>
    </div>
  );
}
