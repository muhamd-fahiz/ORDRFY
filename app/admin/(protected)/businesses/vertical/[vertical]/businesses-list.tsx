"use client";

import { useState } from "react";
import Link from "next/link";
import { Chip } from "@/components/ui/Chip";

export interface VerticalBusinessRow {
  id: string;
  name: string;
  subscriptionStatus: string;
  deletedAt: string | null;
  createdAt: string;
  connectedChannels: string;
}

/**
 * Client-side substring search over name, same pattern already used for the owner app's
 * Contacts List (ContactsList's searchText field) -- filtering an array already fully
 * fetched, not the dedicated full-text/universal search system CLAUDE.md's "what NOT to
 * build" list excludes. Appropriate at this product's actual admin-panel scale (a handful of
 * pilot businesses per vertical for the foreseeable future); if a vertical ever genuinely
 * reaches thousands of rows, this would need to move server-side, but building that ahead of
 * any real need would be exactly the over-engineering this project's own standing
 * instructions call out.
 */
export function VerticalBusinessesList({ businesses }: { businesses: VerticalBusinessRow[] }) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const visibleBusinesses = normalizedQuery
    ? businesses.filter((b) => b.name.toLowerCase().includes(normalizedQuery))
    : businesses;

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by business name"
        className="w-full max-w-sm rounded-lg border border-ink-15 px-4 py-3 font-app text-base text-ink placeholder:text-ink-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-strong lg:text-lg"
      />

      {visibleBusinesses.length === 0 ? (
        <p className="font-app text-lg text-ink-70">
          {normalizedQuery ? "No businesses match that search." : "No businesses yet."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse font-app text-base lg:text-lg">
            <thead>
              <tr className="border-b border-ink-15 text-left text-ink-40">
                <th className="py-4 pr-8">Name</th>
                <th className="py-4 pr-8">Status</th>
                <th className="py-4 pr-8">Channels connected</th>
                <th className="py-4 pr-8">Created</th>
              </tr>
            </thead>
            <tbody>
              {visibleBusinesses.map((b) => (
                <tr key={b.id} className="border-b border-ink-15">
                  <td className="py-4 pr-8">
                    <Link href={`/admin/businesses/${b.id}`} className="font-semibold text-pink-strong hover:underline">
                      {b.name}
                    </Link>
                    {b.deletedAt && (
                      <span className="ml-2">
                        <Chip tone="attention">deleted</Chip>
                      </span>
                    )}
                  </td>
                  <td className="py-4 pr-8 capitalize">{b.subscriptionStatus}</td>
                  <td className="py-4 pr-8">{b.connectedChannels}</td>
                  <td className="py-4 pr-8 text-ink-40">{b.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
