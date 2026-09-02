"use client";

import { useMemo, useState } from "react";
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

const PAGE_SIZE_OPTIONS = [50, 100, 150] as const;

/**
 * Client-side substring search + pagination over an array already fully fetched -- same
 * pattern already used for the owner app's Contacts List (ContactsList's searchText field),
 * not the dedicated full-text/universal search system CLAUDE.md's "what NOT to build" list
 * excludes. Appropriate at this product's actual admin-panel scale; if a vertical ever
 * genuinely reaches thousands of rows, this would need to move server-side, but building
 * that ahead of any real need would be over-engineering.
 */
export function VerticalBusinessesList({ businesses }: { businesses: VerticalBusinessRow[] }) {
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [page, setPage] = useState(1);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleBusinesses = useMemo(
    () => (normalizedQuery ? businesses.filter((b) => b.name.toLowerCase().includes(normalizedQuery)) : businesses),
    [businesses, normalizedQuery],
  );

  const totalPages = Math.max(Math.ceil(visibleBusinesses.length / pageSize), 1);
  const currentPage = Math.min(page, totalPages);
  const pageItems = visibleBusinesses.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function handleQueryChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  function handlePageSizeChange(value: number) {
    setPageSize(value);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="Search by business name"
        className="w-full max-w-sm rounded-lg border border-ink-15 px-3 py-2 font-app text-sm text-ink placeholder:text-ink-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-strong"
      />

      {pageItems.length === 0 ? (
        <p className="font-app text-sm text-ink-70">
          {normalizedQuery ? "No businesses match that search." : "No businesses yet."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse font-app text-sm">
            <thead>
              <tr className="border-b border-ink-15 text-left text-ink-40">
                <th className="py-2.5 pr-6">Name</th>
                <th className="py-2.5 pr-6">Status</th>
                <th className="py-2.5 pr-6">Channels connected</th>
                <th className="py-2.5 pr-6">Created</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((b) => (
                <tr key={b.id} className="border-b border-ink-15">
                  <td className="py-2.5 pr-6">
                    <Link href={`/admin/businesses/${b.id}`} className="font-semibold text-pink-strong hover:underline">
                      {b.name}
                    </Link>
                    {b.deletedAt && (
                      <span className="ml-2">
                        <Chip tone="attention">deleted</Chip>
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-6 capitalize">{b.subscriptionStatus}</td>
                  <td className="py-2.5 pr-6">{b.connectedChannels}</td>
                  <td className="py-2.5 pr-6 text-ink-40">{b.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {visibleBusinesses.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-4 pt-1 font-app text-sm text-ink-70">
          <label className="flex items-center gap-2">
            Rows per page
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="rounded-md border border-ink-15 px-2 py-1 text-sm text-ink"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage <= 1}
              className="rounded-md border border-ink-15 px-2.5 py-1 text-sm text-ink-70 transition-colors hover:bg-ink-15/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="rounded-md border border-ink-15 px-2.5 py-1 text-sm text-ink-70 transition-colors hover:bg-ink-15/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
