"use client";

import { useState } from "react";
import Link from "next/link";
import { Chip } from "@/components/ui/Chip";
import { AmountCell } from "./amount-cell";

export interface SubscriptionRow {
  id: string;
  name: string;
  vertical: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  monthlyAmount: number | null;
}

const STATUS_TONE: Record<string, "confirmed" | "attention" | "neutral"> = {
  active: "confirmed",
  trial: "neutral",
  inactive: "attention",
};

const STATUS_ORDER = ["active", "trial", "inactive"];

/**
 * Cross-vertical by design -- the one place that deliberately does NOT split by vertical
 * (unlike /admin/businesses), since "who's paying, who's on trial, who's inactive" is a
 * billing-status question that cuts across verticals, not a per-vertical one.
 *
 * The Amount column (AmountCell) is a manually-set number, not a real invoice or payment
 * history -- business_entitlements and pricing_plans are both still empty in this database,
 * and real subscription prices are still "₹--" placeholders on the marketing site itself
 * (Pricing.tsx). This is the deliberately small first step (ADR-0033); a real invoice-history
 * table is a separate, later decision once actual billing exists.
 */
export function SubscriptionsList({ subscriptions }: { subscriptions: SubscriptionRow[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [verticalFilter, setVerticalFilter] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLowerCase();
  const searchFiltered = normalizedQuery
    ? subscriptions.filter((s) => s.name.toLowerCase().includes(normalizedQuery))
    : subscriptions;
  const statusFilteredList = statusFilter ? searchFiltered.filter((s) => s.subscriptionStatus === statusFilter) : searchFiltered;
  const visible = verticalFilter ? statusFilteredList.filter((s) => s.vertical === verticalFilter) : statusFilteredList;

  // Both filters' counts reflect the search text and each other, same pattern already used
  // for the Customers screen's stage chips -- only each filter's own selection stays out of
  // its own count, since that's what the chip represents.
  const statusCounts = new Map<string, number>();
  for (const s of searchFiltered) {
    statusCounts.set(s.subscriptionStatus, (statusCounts.get(s.subscriptionStatus) ?? 0) + 1);
  }
  const verticalCounts = new Map<string, number>();
  for (const s of statusFilteredList) {
    verticalCounts.set(s.vertical, (verticalCounts.get(s.vertical) ?? 0) + 1);
  }
  const verticals = [...new Set(subscriptions.map((s) => s.vertical))].sort();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter(null)}
          className={`rounded-full px-4 py-2 font-app text-base font-bold transition-colors ${
            statusFilter === null ? "bg-pink-strong text-paper-raised" : "bg-ink-15 text-ink-70 hover:bg-ink-15/70"
          }`}
        >
          All ({searchFiltered.length})
        </button>
        {STATUS_ORDER.filter((status) => statusCounts.get(status)).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`rounded-full px-4 py-2 font-app text-base font-bold capitalize transition-colors ${
              statusFilter === status ? "bg-pink-strong text-paper-raised" : "bg-ink-15 text-ink-70 hover:bg-ink-15/70"
            }`}
          >
            {status} ({statusCounts.get(status)})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setVerticalFilter(null)}
          className={`rounded-full px-3.5 py-1.5 font-app text-sm font-semibold capitalize transition-colors ${
            verticalFilter === null ? "bg-ink text-paper" : "bg-ink-15/60 text-ink-70 hover:bg-ink-15"
          }`}
        >
          All verticals
        </button>
        {verticals
          .filter((v) => verticalCounts.get(v))
          .map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVerticalFilter(v)}
              className={`rounded-full px-3.5 py-1.5 font-app text-sm font-semibold capitalize transition-colors ${
                verticalFilter === v ? "bg-ink text-paper" : "bg-ink-15/60 text-ink-70 hover:bg-ink-15"
              }`}
            >
              {v} ({verticalCounts.get(v)})
            </button>
          ))}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by business name"
        className="w-full max-w-sm rounded-lg border border-ink-15 px-4 py-3 font-app text-base text-ink placeholder:text-ink-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-strong lg:text-lg"
      />

      {visible.length === 0 ? (
        <p className="font-app text-lg text-ink-70">{normalizedQuery ? "No businesses match that search." : "No businesses yet."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse font-app text-base lg:text-lg">
            <thead>
              <tr className="border-b border-ink-15 text-left text-ink-40">
                <th className="py-4 pr-8">Business</th>
                <th className="py-4 pr-8">Vertical</th>
                <th className="py-4 pr-8">Status</th>
                <th className="py-4 pr-8">Trial ends</th>
                <th className="py-4 pr-8">Amount (₹/mo)</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.id} className="border-b border-ink-15">
                  <td className="py-4 pr-8">
                    <Link href={`/admin/businesses/${s.id}`} className="font-semibold text-pink-strong hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="py-4 pr-8 capitalize">{s.vertical}</td>
                  <td className="py-4 pr-8">
                    <Chip tone={STATUS_TONE[s.subscriptionStatus] ?? "neutral"}>{s.subscriptionStatus}</Chip>
                  </td>
                  <td className="py-4 pr-8 text-ink-40">{s.trialEndsAt ?? "—"}</td>
                  <td className="py-4 pr-8">
                    <AmountCell businessId={s.id} amount={s.monthlyAmount} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
