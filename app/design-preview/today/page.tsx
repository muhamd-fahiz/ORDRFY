import Link from "next/link";
import { getTodayViewData, listBusinessOptions } from "@/lib/data/today";
import { formatRelativeTime } from "@/lib/design/format-time";
import { AttentionBanner } from "@/components/ui/AttentionBanner";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ContactCard } from "@/components/ui/ContactCard";
import { VerticalBadge } from "@/components/ui/VerticalBadge";

export default async function TodayPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ business?: string }>;
}) {
  const { business: requestedBusinessId } = await searchParams;
  const businesses = await listBusinessOptions();

  if (businesses.length === 0) {
    return (
      <main className="mx-auto max-w-sm px-4 py-8">
        <p className="font-app text-sm text-ink-70">
          No businesses in this database yet. Run{" "}
          <code className="font-data text-xs">node scripts/seed-dev-preview-data.mjs</code> to create
          a few realistic ones to preview against.
        </p>
      </main>
    );
  }

  const businessId = requestedBusinessId ?? businesses[0]!.id;
  const today = await getTodayViewData(businessId);

  if (!today) {
    return (
      <main className="mx-auto max-w-sm px-4 py-8">
        <p className="font-app text-sm text-ink-70">No business found for that id.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-8">
      <p className="mb-1 font-data text-[0.65rem] uppercase tracking-widest text-ink-40">
        Today &middot; real seeded data
      </p>
      <h1 className="mb-5 font-display text-2xl font-bold">
        Chats in. <span className="text-pink">Orders out.</span>
      </h1>

      <div className="mb-5 flex flex-wrap gap-2">
        {businesses.map((b) => (
          <Link key={b.id} href={`/design-preview/today?business=${b.id}`}>
            <Button variant={b.id === businessId ? "primary" : "secondary"} size="sm">
              {b.name}
            </Button>
          </Link>
        ))}
      </div>

      <section className="rounded-2xl border border-ink-15 bg-paper-raised p-4">
        <div className="mb-3 flex items-center justify-between">
          <VerticalBadge vertical={today.vertical} variant="icon" />
        </div>
        <h2 className="mb-2 font-app text-xs font-semibold uppercase tracking-wide text-ink-40">Today</h2>

        {today.unresolvedAttentionCount > 0 && (
          <div className="mb-3">
            <AttentionBanner count={today.unresolvedAttentionCount} />
          </div>
        )}

        {today.contacts.length === 0 ? (
          <p className="font-app text-sm text-ink-70">No contacts yet for this business.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {today.contacts.map((contact) => (
              <ContactCard
                key={contact.id}
                name={contact.name}
                timeLabel={formatRelativeTime(contact.lastMessageAt)}
                message={contact.lastMessage}
                stageChip={<Chip tone="neutral">{contact.stageLabel ?? "No stage set"}</Chip>}
                action={
                  contact.hasUnresolvedAttention ? (
                    <Button variant="secondary" size="sm">
                      Review
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
