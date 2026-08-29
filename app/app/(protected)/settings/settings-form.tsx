"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { BusinessProfile } from "@/lib/data/business-profile";

export function SettingsForm({ profile }: { profile: BusinessProfile }) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [timezone, setTimezone] = useState(profile.timezone);
  const [preferredLanguage, setPreferredLanguage] = useState(profile.preferredLanguage);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const response = await fetch("/api/app/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, email, timezone, preferredLanguage }),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string };
    setSubmitting(false);

    if (!response.ok || !body.ok) {
      setMessage({ text: body.error ?? "Something went wrong.", isError: true });
      return;
    }
    setMessage({ text: "Saved.", isError: false });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 font-app text-sm text-ink-70">
        Business name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-lg border border-ink-15 px-3 py-2 font-app text-ink"
        />
      </label>

      <label className="flex flex-col gap-1 font-app text-sm text-ink-70">
        Phone
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-lg border border-ink-15 px-3 py-2 font-app text-ink"
        />
      </label>

      <label className="flex flex-col gap-1 font-app text-sm text-ink-70">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-ink-15 px-3 py-2 font-app text-ink"
        />
      </label>

      <label className="flex flex-col gap-1 font-app text-sm text-ink-70">
        Timezone
        <input
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          required
          className="rounded-lg border border-ink-15 px-3 py-2 font-app text-ink"
        />
      </label>

      <label className="flex flex-col gap-1 font-app text-sm text-ink-70">
        Preferred language
        <input
          value={preferredLanguage}
          onChange={(e) => setPreferredLanguage(e.target.value)}
          required
          className="rounded-lg border border-ink-15 px-3 py-2 font-app text-ink"
        />
        <span className="text-xs text-ink-40">
          The language customer replies are matched against (e.g. en, hi). Falls back to English if no rules exist
          for this language.
        </span>
      </label>

      {message && <p className={`font-app text-sm ${message.isError ? "text-attention" : "text-confirmed"}`}>{message.text}</p>}

      <Button type="submit" disabled={submitting} className="mt-2 w-fit">
        {submitting ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}
