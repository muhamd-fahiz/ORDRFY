"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/db/browser";

/**
 * Clicking the emailed confirmation link lands here with the new session in the URL, which
 * @supabase/ssr's browser client picks up automatically -- same mechanism as
 * app/app/reset-password/reset-password-form.tsx, checking/ready/invalid model reused
 * exactly, just listening for SIGNED_IN (email confirmation) rather than PASSWORD_RECOVERY.
 * Once ready, this always sends the new user to /onboarding, never /app/today -- avoiding
 * making a just-verified customer manually rediscover onboarding (ADR-0040) -- the
 * onboarding layout itself (Phase 4) is responsible for creating their first draft.
 */
type SessionStatus = "checking" | "ready" | "invalid";

export function ConfirmedClient() {
  const router = useRouter();
  const [status, setStatus] = useState<SessionStatus>("checking");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") setStatus("ready");
    });

    // Covers the case where the session was already established (event fired) before this
    // listener attached -- same race reset-password-form.tsx already guards against.
    supabase.auth.getSession().then(({ data }) => {
      setStatus((current) => (current === "ready" ? current : data.session ? "ready" : "invalid"));
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (status !== "ready") return;
    const timeout = setTimeout(() => {
      router.replace("/onboarding");
      router.refresh();
    }, 1200);
    return () => clearTimeout(timeout);
  }, [status, router]);

  if (status === "checking") {
    return <p className="text-sm text-ink-70">Confirming your email...</p>;
  }

  if (status === "invalid") {
    return (
      <p className="rounded-lg bg-attention-soft p-3 text-sm text-attention">
        This link is invalid or has expired. Sign up again to get a fresh one.
      </p>
    );
  }

  return (
    <p className="rounded-lg bg-confirmed-soft p-3 text-sm text-ink">
      Email confirmed! Taking you into setting up your business...
    </p>
  );
}
