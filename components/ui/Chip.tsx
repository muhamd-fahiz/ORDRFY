import type { ReactNode } from "react";

type ChipTone = "neutral" | "confirmed" | "attention";

interface ChipProps {
  tone?: ChipTone;
  children: ReactNode;
}

const TONE_CLASSES: Record<ChipTone, string> = {
  neutral: "bg-ink-15 text-ink-70",
  confirmed: "bg-confirmed-soft text-confirmed",
  attention: "bg-attention-soft text-attention",
};

// Pipeline-stage and semantic-status chips share this one primitive. Which pipeline_stage
// maps to which tone is a display-layer decision made by the caller, not baked in here --
// this component has no idea what a "stage" is, only how to render a labeled pill.
export function Chip({ tone = "neutral", children }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 font-app text-xs font-bold ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
