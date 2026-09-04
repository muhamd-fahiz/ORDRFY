"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * Triggers a real sample customer message through the actual automation pipeline (see
 * app/api/app/demo/send-sample-message/route.ts). Rendered both in Today's empty state (the
 * post-onboarding "dead end" fix) and, in compact form, above a populated contact list -- an
 * owner can try it again any time, not just once, since the route reuses the same sample
 * contact identity rather than creating a new one per tap.
 */
export function TrySampleMessage({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);

  async function handleClick() {
    setPending(true);
    setError(null);
    const response = await fetch("/api/app/demo/send-sample-message", { method: "POST" });
    const body = (await response.json()) as { ok?: boolean; error?: string };
    setPending(false);

    if (!response.ok || !body.ok) {
      setError(body.error ?? "Something went wrong.");
      return;
    }
    setJustSent(true);
    router.refresh();
  }

  return (
    <div className={compact ? "mb-3 flex flex-col items-start gap-1" : "flex flex-col items-start gap-2"}>
      <Button variant={compact ? "ghost" : "secondary"} size="sm" onClick={handleClick} disabled={pending}>
        {pending ? "Sending sample message..." : compact ? "Try another sample message" : "Try Ordrfy with a sample message"}
      </Button>
      {justSent && !error && (
        <p className="font-app text-xs text-confirmed">Sent. Here&apos;s how Ordrfy responded, from Priya (Sample Customer).</p>
      )}
      {error && <p className="font-app text-xs text-attention">{error}</p>}
    </div>
  );
}
