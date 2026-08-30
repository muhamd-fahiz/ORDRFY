import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";

export interface OrderSlipRow {
  label: string;
  value: string;
  mono?: boolean;
  pink?: boolean;
}

interface OrderSlipProps {
  orderNumber: string;
  badge: string;
  rows: OrderSlipRow[];
  /** Slot so callers can compose either the hero's "carbon copy + wordmark" footer or the
   *  verticals section's "dot + note" footer without OrderSlip needing to know which. */
  footer: ReactNode;
  animate?: boolean;
  className?: string;
}

/**
 * The signature "chat becomes a slip" device -- used by both the hero and the verticals
 * showcase (design_handoff_ordrfy_landing/Ordrfy Landing.dc.html blocks 2 and 4), which is
 * exactly why this is its own component instead of being duplicated inline twice.
 */
export function OrderSlip({ orderNumber, badge, rows, footer, animate = false, className = "" }: OrderSlipProps) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <div className="absolute inset-[14px_-12px_-14px_12px] rounded-md bg-pink opacity-85" aria-hidden="true" />
      <div className={`relative overflow-hidden rounded-md bg-paper ${animate ? "motion-safe:animate-slipin" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-ink px-5 py-4">
          <span className="font-data text-xs font-bold tracking-[0.1em] text-paper">ORDER {orderNumber}</span>
          <span className="rounded-[3px] bg-highlight px-[9px] py-[5px] font-data text-[10.5px] font-bold tracking-[0.1em] text-ink">{badge}</span>
        </div>
        <div className="grid gap-3 px-5 pb-1.5 pt-[18px]">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/[0.08] pb-[11px] last:border-b-0">
              <span className="font-data text-[11px] tracking-[0.1em] text-ink/45">{row.label}</span>
              <span
                className={
                  row.mono
                    ? `font-data text-[15px] font-bold ${row.pink ? "text-pink" : "text-ink"} text-right`
                    : `text-right font-app text-[14.5px] font-semibold ${row.pink ? "text-pink" : "text-ink"}`
                }
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t-2 border-dashed border-ink/[0.22]" />
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-[13px]">{footer}</div>
      </div>
    </div>
  );
}

/** The hero's exact footer: a plain label plus the 12px wordmark lockup, per the handoff's slip-footer spec. */
export function CarbonCopyFooter() {
  return (
    <>
      <span className="font-data text-[10.5px] tracking-[0.1em] text-ink/50">CARBON COPY → CUSTOMER</span>
      <Logo variant="wordmark" tone="on-paper" size="sm" />
    </>
  );
}

/** The verticals section's footer: a pink dot plus dynamic copy. */
export function DotNoteFooter({ note }: { note: string }) {
  return (
    <span className="flex items-center gap-[9px] font-data text-[10.5px] tracking-[0.1em] text-ink/55">
      <span className="h-1.5 w-1.5 flex-none rounded-full bg-pink" aria-hidden="true" />
      {note}
    </span>
  );
}
