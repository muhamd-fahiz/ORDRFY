"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PipelineStageStepper } from "@/components/ui/PipelineStageStepper";

interface Stage {
  id: string;
  stageLabel: string;
}

export function StageChanger({
  contactId,
  stages,
  currentStageId,
}: {
  contactId: string;
  stages: Stage[];
  currentStageId: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(stageId: string) {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/app/contacts/${contactId}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId }),
    });
    const body = (await response.json()) as { ok?: boolean; error?: string };
    setPending(false);
    if (!response.ok || !body.ok) {
      setError(body.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <PipelineStageStepper stages={stages} currentStageId={currentStageId} onSelect={handleSelect} disabled={pending} />
      {error && <p className="font-app text-xs text-attention">{error}</p>}
    </div>
  );
}
