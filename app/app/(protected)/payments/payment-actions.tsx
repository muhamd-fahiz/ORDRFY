"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function PaymentActions({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    router.refresh();
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
