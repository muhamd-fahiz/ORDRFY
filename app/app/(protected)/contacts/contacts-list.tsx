"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { ContactCard } from "@/components/ui/ContactCard";
import type { ContactsListData, ContactsListRow } from "@/lib/data/contacts-list";

interface ContactsListProps {
  stages: ContactsListData["stages"];
  // timeLabel is added by the server page, not computed here -- see contacts/page.tsx's
  // comment for why formatRelativeTime() can never run inside this client component.
  contacts: (ContactsListRow & { timeLabel: string })[];
}

// Stage filter (structured data the product already has) plus a plain substring search over
// name/phone/handle -- both applied client-side over the whole already-fetched roster, no
// round trip, no search index. Not the full-text/universal search CLAUDE.md's "what NOT to
// build" list excludes -- that's about a dedicated search system, not filtering an array
// that's already in memory the same way the stage chips already do.
export function ContactsList({ stages, contacts }: ContactsListProps) {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  // Stage chip counts reflect the current search too, so they stay meaningful together --
  // only the stage selection itself stays out of this pass, since that's what the chips represent.
  const searchFilteredContacts = normalizedQuery ? contacts.filter((c) => c.searchText.includes(normalizedQuery)) : contacts;
  const visibleContacts = selectedStageId
    ? searchFilteredContacts.filter((c) => c.stageId === selectedStageId)
    : searchFilteredContacts;

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or phone"
        className="mb-3 w-full rounded-lg border border-ink-15 bg-paper-raised px-3 py-2 font-app text-sm text-ink placeholder:text-ink-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-strong"
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedStageId(null)}
          className={`rounded-full px-3 py-1.5 font-app text-xs font-bold transition-colors ${
            selectedStageId === null ? "bg-pink-strong text-paper-raised" : "bg-ink-15 text-ink-70 hover:bg-ink-15/70"
          }`}
        >
          All ({searchFilteredContacts.length})
        </button>
        {stages.map((stage) => {
          const count = searchFilteredContacts.filter((c) => c.stageId === stage.id).length;
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
        <p className="font-app text-sm text-ink-70">
          {normalizedQuery ? "No contacts match that search." : "No contacts in this stage."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleContacts.map((contact) => (
            <ContactCard
              key={contact.id}
              name={contact.name}
              href={`/app/contacts/${contact.id}`}
              timeLabel={contact.timeLabel}
              message={contact.lastMessage}
              stageChip={<Chip tone="neutral">{contact.stageLabel ?? "No stage set"}</Chip>}
            />
          ))}
        </div>
      )}
    </div>
  );
}
