import type { ReactNode } from "react";
import Link from "next/link";
import { Chip } from "./Chip";
import { formatRupees } from "@/lib/design/format-currency";

const PAYMENT_STATUS_TONE = {
  paid: "confirmed",
  overdue: "attention",
  pending: "neutral",
} as const;

interface PaymentCardProps {
  orderReference: string | null;
  amountDue: number;
  amountPaid: number;
  status: string;
  dueDate: string | null;
  /** Omit when there's nothing for the owner to do -- e.g. an already-paid record. */
  action?: ReactNode;
  /** Set on the business-wide Payments screen, where one card can belong to any contact.
   *  Omitted on Contact Detail, where the contact is already the page's own context. */
  contactName?: string;
  contactHref?: string;
}

// Shared between Contact Detail's per-contact payment list and the business-wide Payments
// screen -- one rendering of "order ref, status, amount, due date" so the two never drift.
export function PaymentCard({
  orderReference,
  amountDue,
  amountPaid,
  status,
  dueDate,
  action,
  contactName,
  contactHref,
}: PaymentCardProps) {
  return (
    <div className="rounded-lg border border-ink-15 bg-paper-raised p-3">
      {contactName && (
        <div className="mb-1">
          {contactHref ? (
            <Link href={contactHref} className="font-app text-sm font-bold text-ink underline-offset-2 hover:underline">
              {contactName}
            </Link>
          ) : (
            <span className="font-app text-sm font-bold text-ink">{contactName}</span>
          )}
        </div>
      )}
      <div className="mb-1 flex items-center justify-between">
        <span className="font-data text-xs text-ink-40">{orderReference ?? "—"}</span>
        <Chip tone={PAYMENT_STATUS_TONE[status as keyof typeof PAYMENT_STATUS_TONE] ?? "neutral"}>{status}</Chip>
      </div>
      <div className="flex items-baseline justify-between font-data">
        <span className="text-sm text-ink">
          {formatRupees(amountPaid)} <span className="text-ink-40">of {formatRupees(amountDue)}</span>
        </span>
        {dueDate && <span className="text-xs text-ink-40">due {dueDate}</span>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
