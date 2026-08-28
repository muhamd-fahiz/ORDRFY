import type { ReactNode } from "react";

interface ContactCardProps {
  name: string;
  /** Pre-formatted relative or absolute time -- this component doesn't format dates itself. */
  timeLabel: string;
  message: string;
  stageChip: ReactNode;
  action: ReactNode;
}

// The single-tap unit of the owner app: one contact, their last message, their pipeline
// stage, and exactly one action. Deliberately has no data-fetching or business logic --
// callers decide what "the" action is (send reminder, mark paid, ...) per pipeline_stage.
export function ContactCard({ name, timeLabel, message, stageChip, action }: ContactCardProps) {
  return (
    <div className="rounded-lg border border-ink-15 bg-paper-raised p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-app text-sm font-bold text-ink">{name}</span>
        <span className="font-data text-[0.65rem] text-ink-40">{timeLabel}</span>
      </div>
      <p className="mt-1 mb-3 font-app text-sm text-ink-70">{message}</p>
      <div className="flex items-center justify-between">
        {stageChip}
        {action}
      </div>
    </div>
  );
}
