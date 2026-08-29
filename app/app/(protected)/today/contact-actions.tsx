"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type Pending = "review" | "reminder" | null;

export function ContactActions({
  contactId,
  hasUnresolvedAttention,
}: {
  contactId: string;
  hasUnresolvedAttention: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleReview() {
    setPending("review");
    setMessage(null);
    const response = await fetch("/api/app/attention/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId }),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string };
    setPending(null);
    if (!response.ok || !body.ok) {
      setMessage(body.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  async function handleSendReminder() {
    setPending("reminder");
    setMessage(null);
    const response = await fetch("/api/app/reminders/send-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId }),
    });
    const body = (await response.json()) as {
      ok?: boolean;
      error?: string;
      status?: string;
      failureReason?: string | null;
    };
    setPending(null);
    if (!response.ok || !body.ok) {
      setMessage(body.error ?? "Something went wrong.");
      return;
    }
    if (body.status === "sent") setMessage("Reminder sent.");
    else if (body.status === "failed") setMessage(`Couldn't send: ${body.failureReason ?? "unknown reason"}`);
    else setMessage("Reminder queued.");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {hasUnresolvedAttention && (
          <Button variant="secondary" size="sm" disabled={pending !== null} onClick={handleReview}>
            {pending === "review" ? "..." : "Review"}
          </Button>
        )}
        <Button variant="primary" size="sm" disabled={pending !== null} onClick={handleSendReminder}>
          {pending === "reminder" ? "..." : "Send Reminder"}
        </Button>
      </div>
      {message && <p className="font-app text-[0.65rem] text-ink-40">{message}</p>}
    </div>
  );
}
