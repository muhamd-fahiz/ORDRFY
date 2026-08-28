"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Goes through a server route (not supabase.auth.signInWithPassword() directly from the
    // browser) specifically so login attempts pass through server-side rate limiting first
    // -- see app/api/admin/login/route.ts.
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string };

    if (!response.ok || !body.ok) {
      setError(body.error ?? "Something went wrong.");
      setSubmitting(false);
      return;
    }

    // The protected layout / login page server-side redirect handles routing to the
    // correct next step (MFA enrollment, MFA challenge, or straight into the panel) based
    // on this session's actual state -- this page doesn't need to guess which.
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border border-neutral-300 px-3 py-2"
        />
      </label>
      {error && <p className="text-sm text-status-overdue">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-brand px-3 py-2 text-sm font-medium text-brand-foreground disabled:opacity-50"
      >
        {submitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
