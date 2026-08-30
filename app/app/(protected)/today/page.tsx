import { requireReadyOwnerSession } from "@/lib/auth/owner-guard";
import { createRlsClient } from "@/lib/db/server";
import { getTodayViewData } from "@/lib/data/today";
import { formatRelativeTime } from "@/lib/design/format-time";
import { AttentionBanner } from "@/components/ui/AttentionBanner";
import { Chip } from "@/components/ui/Chip";
import { ContactCard } from "@/components/ui/ContactCard";
import { VerticalBadge } from "@/components/ui/VerticalBadge";
import type { VerticalKey } from "@/lib/design/verticals";
import { ContactActions } from "./contact-actions";

export default async function TodayPage() {
  const session = await requireReadyOwnerSession();
  const supabase = await createRlsClient();
  const today = await getTodayViewData(supabase, session.businessId);

  return (
    <div className="mx-auto max-w-sm px-4 py-6">
      <div className="mb-3 flex items-center justify-between">
        <VerticalBadge vertical={session.vertical as VerticalKey} variant="icon" />
      </div>
      <h1 className="mb-2 font-app text-xs font-semibold uppercase tracking-wide text-ink-40">Today</h1>

      {today.unresolvedAttentionCount > 0 && (
        <div className="mb-3">
          <AttentionBanner count={today.unresolvedAttentionCount} href="/app/attention" />
        </div>
      )}

      {today.contacts.length === 0 ? (
        <p className="font-app text-sm text-ink-70">
          No customer messages yet. Once WhatsApp or Instagram is connected, new chats will show up here automatically.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {today.contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              name={contact.name}
              href={`/app/contacts/${contact.id}`}
              timeLabel={formatRelativeTime(contact.lastMessageAt)}
              message={contact.lastMessage}
              stageChip={<Chip tone="neutral">{contact.stageLabel ?? "No stage set"}</Chip>}
              action={
                <ContactActions contactId={contact.id} hasUnresolvedAttention={contact.hasUnresolvedAttention} />
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
