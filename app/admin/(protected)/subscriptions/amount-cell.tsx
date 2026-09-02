"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupees } from "@/lib/design/format-currency";

/**
 * The "simple" half of ADR-0033: a manually-set number, not a real invoice. Click to edit,
 * same single-row-action shape already used elsewhere in the admin/owner apps (PaymentActions,
 * StageChanger) -- no modal, no separate page.
 */
export function AmountCell({ businessId, amount }: { businessId: string; amount: number | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(amount !== null ? String(amount) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (trimmed !== "" && (parsed === null || Number.isNaN(parsed) || parsed < 0)) {
      setError("Enter a valid amount.");
      return;
    }

    setSaving(true);
    const response = await fetch(`/api/admin/businesses/${businessId}/subscription-amount`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parsed }),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string };
    setSaving(false);

    if (!response.ok || !body.ok) {
      setError(body.error ?? "Something went wrong.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  function handleCancel() {
    setEditing(false);
    setValue(amount !== null ? String(amount) : "");
    setError(null);
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min="0"
          step="1"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 500"
          className="w-24 rounded-md border border-ink-15 px-2 py-1 font-app text-sm text-ink"
        />
        <button type="button" onClick={handleSave} disabled={saving} className="font-app text-sm font-semibold text-pink-strong hover:underline">
          {saving ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={handleCancel} className="font-app text-sm text-ink-40 hover:text-ink">
          Cancel
        </button>
        {error && <span className="font-app text-sm text-attention">{error}</span>}
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="text-left hover:underline">
      {amount !== null ? formatRupees(amount) : <span className="text-ink-40">Not set</span>}
    </button>
  );
}
