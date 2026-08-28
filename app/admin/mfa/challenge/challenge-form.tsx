"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/db/browser";

export function ChallengeForm() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFactor() {
      const supabase = createBrowserSupabaseClient();
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) {
        setError(listError.message);
        setLoading(false);
        return;
      }
      const verified = data.totp.find((f) => f.status === "verified");
      if (!verified) {
        setError("No verified authenticator found on this account. Contact another admin.");
        setLoading(false);
        return;
      }
      setFactorId(verified.id);
      setLoading(false);
    }

    loadFactor();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setSubmitting(true);
    setError(null);

    const supabase = createBrowserSupabaseClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeError) {
      setError(challengeError.message);
      setSubmitting(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      setError(verifyError.message);
      setSubmitting(false);
      return;
    }

    router.replace("/admin/businesses");
    router.refresh();
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Loading...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        6-digit code
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          required
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded border border-neutral-300 px-3 py-2 tracking-widest"
          autoFocus
        />
      </label>
      {error && <p className="text-sm text-status-overdue">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !factorId}
        className="rounded bg-brand px-3 py-2 text-sm font-medium text-brand-foreground disabled:opacity-50"
      >
        {submitting ? "Verifying..." : "Verify"}
      </button>
    </form>
  );
}
