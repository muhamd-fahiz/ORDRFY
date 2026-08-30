"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function PaymentActions({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function handleMarkPaid() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/app/payments/${paymentId}/mark-paid`, { method: "POST" });
    const body = (await response.json()) as { ok?: boolean; error?: string };
    setPending(false);
    if (!response.ok || !body.ok) {
      setError(body.error ?? "Something went wrong.");
      return;
    }
    // Shown briefly before router.refresh() re-renders this card as "paid" (which removes
    // this action entirely) -- without it, marking a payment paid gave no feedback beyond
    // the button silently vanishing, easy to misread as "did that even work?".
    setConfirmed(true);
    setTimeout(() => router.refresh(), 900);
  }

  if (confirmed) {
    return <p className="font-app text-xs font-semibold text-confirmed">Marked as paid.</p>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="primary" size="sm" disabled={pending} onClick={handleMarkPaid}>
        {pending ? "..." : "Mark as Paid"}
      </Button>
      {error && <p className="font-app text-[0.65rem] text-attention">{error}</p>}
    </div>
  );
}
