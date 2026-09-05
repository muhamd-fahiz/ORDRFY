"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * "Make Automation Visible" phase: Send Reminder removed from here (it always sent a
 * payment-due reminder regardless of whether the contact had any real payment context --
 * see app/api/app/reminders/send-now/route.ts's own updated guard for the enforcement side
 * of this fix). Only "Mark as handled" remains.
 */
export function ContactActions({
  contactId,
  hasUnresolvedAttention,
}: {
  contactId: string;
  hasUnresolvedAttention: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Shown briefly before router.refresh() re-renders this card without the "Mark as
  // handled" button at all -- same pattern as Payments' "Marked as paid.", so the owner
  // gets the same immediate confirmation instead of the button just silently vanishing.
  const [handledConfirmed, setHandledConfirmed] = useState(false);

  async function handleReview() {
    setPending(true);
    setMessage(null);
    const response = await fetch("/api/app/attention/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId }),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string };
    setPending(false);
    if (!response.ok || !body.ok) {
      setMessage(body.error ?? "Something went wrong.");
      return;
    }
    setHandledConfirmed(true);
    setTimeout(() => router.refresh(), 900);
  }

  if (!hasUnresolvedAttention) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      {handledConfirmed ? (
        <span className="font-app text-xs font-semibold text-confirmed">Marked as handled.</span>
      ) : (
        <Button variant="secondary" size="sm" disabled={pending} onClick={handleReview}>
          {pending ? "..." : "Mark as handled"}
        </Button>
      )}
      {message && <p className="font-app text-[0.65rem] text-ink-40">{message}</p>}
    </div>
  );
}
