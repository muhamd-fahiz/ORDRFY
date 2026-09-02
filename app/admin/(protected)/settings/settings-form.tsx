"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function SettingsForm({ name: initialName, email }: { name: string; email: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; isError: boolean } | null>(null);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);

    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string };
    setSavingProfile(false);

    if (!response.ok || !body.ok) {
      setProfileMessage({ text: body.error ?? "Something went wrong.", isError: true });
      return;
    }
    setProfileMessage({ text: "Saved.", isError: false });
    router.refresh();
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: "New passwords don't match.", isError: true });
      return;
    }

    setSavingPassword(true);
    const response = await fetch("/api/admin/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string };
    setSavingPassword(false);

    if (!response.ok || !body.ok) {
      setPasswordMessage({ text: body.error ?? "Something went wrong.", isError: true });
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage({ text: "Password changed.", isError: false });
  }

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <section className="rounded-xl border border-ink-15 p-6 lg:p-9">
        <h2 className="mb-4 text-base font-semibold uppercase tracking-wide text-ink-40">Admin profile</h2>
        <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-lg text-ink-70">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="rounded-lg border border-ink-15 px-4 py-3 text-lg text-ink"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-lg text-ink-70">
            Email
            <input
              value={email}
              disabled
              className="rounded-lg border border-ink-15 bg-ink-15/30 px-4 py-3 text-lg text-ink-40"
            />
            <span className="text-base text-ink-40">Contact another admin to change your sign-in email.</span>
          </label>
          {profileMessage && (
            <p className={`text-lg ${profileMessage.isError ? "text-attention" : "text-confirmed"}`}>{profileMessage.text}</p>
          )}
          <Button type="submit" disabled={savingProfile} size="md" className="mt-1 w-fit px-6 py-3.5 text-lg">
            {savingProfile ? "Saving..." : "Save changes"}
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-ink-15 p-6 lg:p-9">
        <h2 className="mb-4 text-base font-semibold uppercase tracking-wide text-ink-40">Change password</h2>
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-lg text-ink-70">
            Current password
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="rounded-lg border border-ink-15 px-4 py-3 text-lg text-ink"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-lg text-ink-70">
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="rounded-lg border border-ink-15 px-4 py-3 text-lg text-ink"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-lg text-ink-70">
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="rounded-lg border border-ink-15 px-4 py-3 text-lg text-ink"
            />
          </label>
          {passwordMessage && (
            <p className={`text-lg ${passwordMessage.isError ? "text-attention" : "text-confirmed"}`}>{passwordMessage.text}</p>
          )}
          <Button type="submit" disabled={savingPassword} size="md" className="mt-1 w-fit px-6 py-3.5 text-lg">
            {savingPassword ? "Saving..." : "Change password"}
          </Button>
        </form>
      </section>
    </div>
  );
}
