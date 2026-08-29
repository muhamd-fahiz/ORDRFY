"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { ContactCard } from "@/components/ui/ContactCard";
import { formatRelativeTime } from "@/lib/design/format-time";
import type { ContactsListData } from "@/lib/data/contacts-list";

// Filtering by pipeline stage, not text search (full-text/universal search are both
// explicitly out of V1 scope) -- structured data the product already has, applied entirely
// client-side since the whole roster is already fetched, so a filter tap is instant with no
// round trip.
export function ContactsList({ stages, contacts }: ContactsListData) {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  const visibleContacts = selectedStageId ? contacts.filter((c) => c.stageId === selectedStageId) : contacts;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedStageId(null)}
          className={`rounded-full px-3 py-1.5 font-app text-xs font-bold transition-colors ${
            selectedStageId === null ? "bg-pink-strong text-paper-raised" : "bg-ink-15 text-ink-70 hover:bg-ink-15/70"
          }`}
        >
          All ({contacts.length})
        </button>
        {stages.map((stage) => {
          const count = contacts.filter((c) => c.stageId === stage.id).length;
          if (count === 0) return null;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => setSelectedStageId(stage.id)}
              className={`rounded-full px-3 py-1.5 font-app text-xs font-bold transition-colors ${
                selectedStageId === stage.id ? "bg-pink-strong text-paper-raised" : "bg-ink-15 text-ink-70 hover:bg-ink-15/70"
              }`}
            >
              {stage.stageLabel} ({count})
            </button>
          );
        })}
      </div>

      {visibleContacts.length === 0 ? (
        <p className="font-app text-sm text-ink-70">No contacts in this stage.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleContacts.map((contact) => (
            <ContactCard
              key={contact.id}
              name={contact.name}
              href={`/app/contacts/${contact.id}`}
              timeLabel={formatRelativeTime(contact.lastMessageAt)}
              message={contact.lastMessage}
              stageChip={<Chip tone="neutral">{contact.stageLabel ?? "No stage set"}</Chip>}
            />
          ))}
        </div>
      )}
    </div>
  );
}
