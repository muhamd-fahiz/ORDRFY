import type { ReactNode } from "react";
import Link from "next/link";

interface ContactCardProps {
  name: string;
  /** Pre-formatted relative or absolute time -- this component doesn't format dates itself. */
  timeLabel: string;
  message: string;
  stageChip: ReactNode;
  /** A short secondary line under the message -- e.g. the automatic reply Ordrfy sent, or
   *  why this item needs attention. Omit when there's nothing extra to say; callers own the
   *  content and styling entirely, same as stageChip/action below. */
  note?: ReactNode;
  /** Omit when there's nothing for the owner to do right now -- don't invent a fake action. */
  action?: ReactNode;
  /** When set, the contact's name links to their detail screen. Omit for a non-interactive card. */
  href?: string;
}

// The single-tap unit of the owner app: one contact, their last message, their pipeline
// stage, and at most one action. Deliberately has no data-fetching or business logic --
// callers decide what "the" action is (send reminder, mark paid, ...) per pipeline_stage.
export function ContactCard({ name, timeLabel, message, stageChip, note, action, href }: ContactCardProps) {
  return (
    <div className="rounded-lg border border-ink-15 bg-paper-raised p-3">
      <div className="flex items-baseline justify-between gap-2">
        {href ? (
          <Link href={href} className="font-app text-sm font-bold text-ink underline-offset-2 hover:underline">
            {name}
          </Link>
        ) : (
          <span className="font-app text-sm font-bold text-ink">{name}</span>
        )}
        <span className="font-data text-[0.65rem] text-ink-40">{timeLabel}</span>
      </div>
      <p className="mt-1 font-app text-sm text-ink-70">{message}</p>
      {note && <p className="mt-1 font-app text-sm text-ink-70">{note}</p>}
      <div className="mt-3 flex items-center justify-between">
        {stageChip}
        {action}
      </div>
    </div>
  );
}
