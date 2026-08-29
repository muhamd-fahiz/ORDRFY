"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function CreateOwnerForm({ businessId, defaultEmail }: { businessId: string; defaultEmail: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ email: string; temporaryPassword: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/admin/businesses/${businessId}/create-owner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string; email?: string; temporaryPassword?: string };

    if (!response.ok || !body.ok) {
      setError(body.error ?? "Something went wrong.");
      setSubmitting(false);
      return;
    }

    // Deliberately does NOT call router.refresh() here. The parent page only renders this
    // form while there's no membership yet -- refreshing immediately would re-fetch server
    // data showing the new membership, which makes the parent stop rendering this component
    // (and the one-time password with it) before the admin necessarily had a chance to copy
    // it. Refreshing is the admin's explicit "I've copied it" action below instead.
    setResult({ email: body.email!, temporaryPassword: body.temporaryPassword! });
    setSubmitting(false);
  }

  if (result) {
    return (
      <div className="rounded-lg bg-confirmed-soft p-3 font-app text-sm text-ink">
        <p className="font-semibold text-confirmed">Owner account created.</p>
        <p className="mt-1 text-ink-70">
          Give these to the business owner now (by phone or WhatsApp) -- this password is shown only once
          and is not stored anywhere.
        </p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 font-data text-xs">
          <dt className="text-ink-40">Email</dt>
          <dd>{result.email}</dd>
          <dt className="text-ink-40">Password</dt>
          <dd>{result.temporaryPassword}</dd>
        </dl>
        <Button size="sm" className="mt-3" onClick={() => router.refresh()}>
          I&apos;ve copied this, done
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 font-app text-sm">
      <label className="flex flex-col gap-1 text-ink-70">
        Owner&apos;s email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-ink-15 px-2 py-1 text-ink"
        />
      </label>
      {error && <p className="text-attention">{error}</p>}
      <Button type="submit" size="sm" className="w-fit" disabled={submitting}>
        {submitting ? "Creating..." : "Create owner account"}
      </Button>
    </form>
  );
}
