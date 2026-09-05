import { requireReadyOwnerSession } from "@/lib/auth/owner-guard";
import { createRlsClient } from "@/lib/db/server";
import { getAttentionQueue } from "@/lib/data/attention-queue";
import { formatRelativeTime } from "@/lib/design/format-time";
import { describeAttentionReason } from "@/lib/design/attention-reasons";
import { Chip } from "@/components/ui/Chip";
import { ContactCard } from "@/components/ui/ContactCard";
import { ContactActions } from "../today/contact-actions";

export default async function AttentionPage() {
  const session = await requireReadyOwnerSession();
  const supabase = await createRlsClient();
  const queue = await getAttentionQueue(supabase, session.businessId);

  return (
    <div className="mx-auto max-w-sm px-4 py-6">
      <h1 className="mb-1 font-display text-xl font-bold text-ink">Needs Attention</h1>
      <p className="mb-4 font-app text-xs text-ink-40">Oldest first — customers who&apos;ve been waiting longest.</p>

      {queue.length === 0 ? (
        <p className="font-app text-sm text-ink-70">Nothing needs attention right now.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {queue.map((row) => (
            <ContactCard
              key={row.contactId}
              name={row.unresolvedCount > 1 ? `${row.contactName} (${row.unresolvedCount})` : row.contactName}
              href={`/app/contacts/${row.contactId}`}
              timeLabel={formatRelativeTime(row.lastMessageAt)}
              message={row.lastMessage}
              note={<span className="font-semibold text-attention">{describeAttentionReason(row.reason)}</span>}
              stageChip={<Chip tone="neutral">{row.stageLabel ?? "No status yet"}</Chip>}
              action={<ContactActions contactId={row.contactId} hasUnresolvedAttention />}
            />
          ))}
        </div>
      )}
    </div>
  );
}
