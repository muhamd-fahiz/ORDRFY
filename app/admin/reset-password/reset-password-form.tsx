"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/db/browser";
import { Button } from "@/components/ui/Button";

type SessionStatus = "checking" | "ready" | "invalid";

/** Same flow as app/app/reset-password/reset-password-form.tsx, redirects to /admin/login instead. */
export function ResetPasswordForm() {
  const router = useRouter();
  const [status, setStatus] = useState<SessionStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStatus("ready");
    });

    supabase.auth.getSession().then(({ data }) => {
      setStatus((current) => (current === "ready" ? current : data.session ? "ready" : "invalid"));
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    const supabase = createBrowserSupabaseClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.replace("/admin/login"), 2000);
  }

  if (done) {
    return <p className="rounded-lg bg-confirmed-soft p-3 font-app text-sm text-ink">Password updated. Redirecting you to sign in...</p>;
  }

  if (status === "checking") {
    return <p className="font-app text-sm text-ink-70">Checking your link...</p>;
  }

  if (status === "invalid") {
    return (
      <p className="rounded-lg bg-attention-soft p-3 font-app text-sm text-attention">
        This link is invalid or has expired. Request a new one from the sign-in page.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 font-app text-sm text-ink-70">
        New password
        <input
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-ink-15 px-3 py-2 font-app text-ink"
        />
      </label>
      <label className="flex flex-col gap-1 font-app text-sm text-ink-70">
        Confirm new password
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="rounded-lg border border-ink-15 px-3 py-2 font-app text-ink"
        />
      </label>
      {error && <p className="font-app text-sm text-attention">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving..." : "Set new password"}
      </Button>
    </form>
  );
}
