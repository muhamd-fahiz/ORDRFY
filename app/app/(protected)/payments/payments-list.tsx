"use client";

import { useState } from "react";
import { PaymentCard } from "@/components/ui/PaymentCard";
import { PaymentActions } from "./payment-actions";
import type { PaymentsListRow } from "@/lib/data/payments-list";

type StatusFilter = "all" | "pending" | "overdue" | "paid";

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
];

// Same client-side filter pattern as the Contacts List screen (app/app/(protected)/contacts/contacts-list.tsx)
// -- the whole roster is already fetched, so a filter tap is instant with no round trip.
export function PaymentsList({ payments }: { payments: PaymentsListRow[] }) {
  const [filter, setFilter] = useState<StatusFilter>("all");

  const visiblePayments = filter === "all" ? payments : payments.filter((p) => p.status === filter);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(({ key, label }) => {
          const count = key === "all" ? payments.length : payments.filter((p) => p.status === key).length;
          if (key !== "all" && count === 0) return null;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1.5 font-app text-xs font-bold transition-colors ${
                filter === key ? "bg-pink-strong text-paper-raised" : "bg-ink-15 text-ink-70 hover:bg-ink-15/70"
              }`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {visiblePayments.length === 0 ? (
        <p className="font-app text-sm text-ink-70">No payments in this filter.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {visiblePayments.map((payment) => (
            <PaymentCard
              key={payment.id}
              contactName={payment.contactName}
              contactHref={`/app/contacts/${payment.contactId}`}
              orderReference={payment.orderReference}
              amountDue={payment.amountDue}
              amountPaid={payment.amountPaid}
              status={payment.status}
              dueDate={payment.dueDate}
              action={payment.status !== "paid" ? <PaymentActions paymentId={payment.id} /> : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
