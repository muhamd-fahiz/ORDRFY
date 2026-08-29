"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/db/browser";
import { Button } from "@/components/ui/Button";

export function EnrollForm() {
  const router = useRouter();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function startEnrollment() {
      const supabase = createBrowserSupabaseClient();

      // Clear out any unverified factor left over from a previous abandoned attempt --
      // Supabase rejects a second enrollment while one is already pending. Note:
      // listFactors()'s per-type buckets (e.g. data.totp) are typed as verified-only;
      // data.all is the one that actually includes unverified factors.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const factor of existing?.all ?? []) {
        if (factor.factor_type === "totp" && factor.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `admin-${Date.now()}`,
      });

      if (enrollError) {
        setError(enrollError.message);
        setLoading(false);
        return;
      }

      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setLoading(false);
    }

    startEnrollment();
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
    return <p className="font-app text-sm text-ink-70">Setting up...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {qrCode && (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase returns a data: URI SVG, not a static asset
        <img src={qrCode} alt="Scan with your authenticator app" className="h-40 w-40 self-center" />
      )}
      {secret && (
        <p className="text-center font-app text-xs text-ink-70">
          Can&apos;t scan? Enter this key manually: <code className="font-data">{secret}</code>
        </p>
      )}
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
          />
        </label>
        {error && <p className="font-app text-sm text-attention">{error}</p>}
        <Button type="submit" disabled={submitting || !factorId}>
          {submitting ? "Verifying..." : "Verify and continue"}
        </Button>
      </form>
    </div>
  );
}
