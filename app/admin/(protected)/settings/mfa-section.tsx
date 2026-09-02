"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/db/browser";
import { Button } from "@/components/ui/Button";

interface EnrolledFactor {
  id: string;
  createdAt: string;
}

/**
 * Deliberately does not offer a way to turn MFA off -- admin_users.mfa_required is fixed
 * true for every admin account, by design (higher blast radius than an owner session, see
 * ADR-0017's own reasoning), not a per-admin toggle. The only action here is resetting the
 * enrolled authenticator (lost device, new phone), which reuses the exact enrollment flow
 * app/admin/mfa/enroll/ already has: unenroll the current verified factor, then let the
 * existing getAdminSessionState() guard naturally redirect to /admin/mfa/enroll on the next
 * protected-page visit, the same as a brand-new admin account would see.
 */
export function MfaSection() {
  const router = useRouter();
  const [factor, setFactor] = useState<EnrolledFactor | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.[0];
      setFactor(verified ? { id: verified.id, createdAt: verified.created_at } : null);
      setLoading(false);
    }
    load();
  }, []);

  async function handleReset() {
    if (!factor) return;
    setResetting(true);
    setError(null);

    const supabase = createBrowserSupabaseClient();
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (unenrollError) {
      setError(unenrollError.message);
      setResetting(false);
      return;
    }
    router.push("/admin/mfa/enroll");
  }

  return (
    <section className="rounded-xl border border-ink-15 p-6 lg:p-9">
      <h2 className="mb-4 text-base font-semibold uppercase tracking-wide text-ink-40">Two-factor authentication</h2>
      {loading ? (
        <p className="text-lg text-ink-70">Loading...</p>
      ) : factor ? (
        <div className="flex flex-col gap-3">
          <p className="text-lg text-ink-70">Authenticator app enrolled since {new Date(factor.createdAt).toLocaleDateString()}.</p>
          <p className="text-base text-ink-40">
            Lost your device or switched phones? Reset it here, then set up a new authenticator right away --
            two-factor authentication is required for every admin account and can&apos;t be turned off.
          </p>
          {error && <p className="text-lg text-attention">{error}</p>}
          <Button type="button" variant="secondary" onClick={handleReset} disabled={resetting} className="w-fit px-6 py-3.5 text-lg">
            {resetting ? "Resetting..." : "Reset authenticator app"}
          </Button>
        </div>
      ) : (
        <p className="text-lg text-attention">
          No authenticator app enrolled -- this shouldn&apos;t be possible while signed in. Sign out and back in to
          re-enroll.
        </p>
      )}
    </section>
  );
}
