"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { BusinessProfile } from "@/lib/data/business-profile";

// Every business created so far is India-based and set to Asia/Kolkata (see
// app/admin/(protected)/businesses/new/actions.ts's own default) -- this is genuinely the
// only real option for this product's target market, not a shortened list. If a business
// somehow already has a different value stored, it's added as an extra option below rather
// than silently replaced, so saving Settings without touching this field never changes it.
const TIMEZONE_OPTIONS = [{ value: "Asia/Kolkata", label: "India (IST)" }];

// Matches the only two languages that actually have internal_reply_rules/message_templates
// content today (see ADR-0007) -- offering a language with zero matching content would be a
// choice with no real effect, which is worse for a non-technical owner than not offering it.
const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
];

function withCurrentValue(options: { value: string; label: string }[], current: string) {
  if (options.some((o) => o.value === current)) return options;
  return [...options, { value: current, label: `Current setting (${current})` }];
}

export function SettingsForm({ profile }: { profile: BusinessProfile }) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [timezone, setTimezone] = useState(profile.timezone);
  const [preferredLanguage, setPreferredLanguage] = useState(profile.preferredLanguage);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const timezoneOptions = withCurrentValue(TIMEZONE_OPTIONS, profile.timezone);
  const languageOptions = withCurrentValue(LANGUAGE_OPTIONS, profile.preferredLanguage);

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

      <p className="-mt-1 font-app text-xs text-ink-40">
        Phone and email below are your business&apos;s own contact details — not your WhatsApp
        or Instagram number.
      </p>

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
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          required
          className="rounded-lg border border-ink-15 bg-paper-raised px-3 py-2 font-app text-ink"
        >
          {timezoneOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 font-app text-sm text-ink-70">
        Preferred language
        <select
          value={preferredLanguage}
          onChange={(e) => setPreferredLanguage(e.target.value)}
          required
          className="rounded-lg border border-ink-15 bg-paper-raised px-3 py-2 font-app text-ink"
        >
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-40">Which language Ordrfy should use when replying automatically.</span>
      </label>

      {message && <p className={`font-app text-sm ${message.isError ? "text-attention" : "text-confirmed"}`}>{message.text}</p>}

      <Button type="submit" disabled={submitting} className="mt-2 w-fit">
        {submitting ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}
