"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/db/browser";
import { Button } from "@/components/ui/Button";

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

    router.replace("/admin/dashboard");
    router.refresh();
  }

  if (loading) {
    return <p className="font-app text-sm text-ink-70">Loading...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 font-app text-sm text-ink-70">
        6-digit code
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          required
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded-lg border border-ink-15 px-3 py-2 font-data tracking-widest text-ink"
          autoFocus
        />
      </label>
      {error && <p className="font-app text-sm text-attention">{error}</p>}
      <Button type="submit" disabled={submitting || !factorId}>
        {submitting ? "Verifying..." : "Verify"}
      </Button>
    </form>
  );
}
