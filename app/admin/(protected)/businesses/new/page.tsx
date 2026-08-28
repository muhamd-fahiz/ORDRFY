import { createRlsClient } from "@/lib/db/server";
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
    <div className="flex flex-col gap-4 max-w-md">
      <h1 className="text-lg font-semibold">New Business</h1>
      <form action={createBusiness} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Business name
          <input name="name" required className="rounded border border-neutral-300 px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Vertical
          <select name="vertical" required className="rounded border border-neutral-300 px-3 py-2">
            <option value="">Select a vertical...</option>
            {verticals.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Phone
          <input name="phone" className="rounded border border-neutral-300 px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Email
          <input name="email" type="email" className="rounded border border-neutral-300 px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Timezone
          <input
            name="timezone"
            defaultValue="Asia/Kolkata"
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Preferred language
          <input
            name="preferred_language"
            defaultValue="en"
            className="rounded border border-neutral-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Subscription status
          <select
            name="subscription_status"
            defaultValue="trial"
            className="rounded border border-neutral-300 px-3 py-2"
          >
            <option value="trial">Trial</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <button
          type="submit"
          className="mt-2 rounded bg-brand px-3 py-2 text-sm font-medium text-brand-foreground"
        >
          Create Business
        </button>
      </form>
    </div>
  );
}
