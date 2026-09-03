import { OrderSlip, DotNoteFooter } from "./OrderSlip";
import { CHAOS_MESSAGES, SHIFT_RESOLVED_MESSAGE_INDEX } from "@/lib/marketing/content";

const resolvedMessage = CHAOS_MESSAGES[SHIFT_RESOLVED_MESSAGE_INDEX]!;

const SHIFT_ROWS = [
  { label: "CUSTOMER", value: resolvedMessage.from },
  { label: "ITEM", value: "Kurta set — blue × 1" },
  { label: "ADVANCE", value: "₹500 ✓", mono: true },
  { label: "BALANCE", value: "₹1,200", mono: true, pink: true },
];

/**
 * The ORGANIZATION payoff. Deliberately pulls the exact same message out of
 * CHAOS_MESSAGES (see lib/marketing/content.ts) that ProblemRecognition just showed buried
 * in a pile -- the same conversation resolving into an order is what makes this feel like an
 * actual transformation rather than a second, unrelated illustration. Minimal copy on
 * purpose: the visual (the same bubble reappearing, then becoming a slip) carries the point.
 */
export function TheShift() {
  return (
    <section id="shift" className="bg-paper px-5 py-14 sm:px-14 sm:py-24">
      <div className="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] items-center gap-10 md:gap-16">
        <div>
          <div className="mb-3.5 font-data text-[11px] font-bold tracking-[0.16em] text-pink">THE SHIFT</div>
          <h2 className="mb-4 max-w-[460px] font-display text-[28px] font-bold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[42px]">
            That same message.
            <br />
            Now it&apos;s an order.
          </h2>
          <p className="max-w-[440px] text-pretty text-[16px] leading-[1.6] text-ink/60">
            Ordrfy pulls the details out the moment the conversation happens — item, amount, date — so nothing is
            left for you to remember later.
          </p>
        </div>

        <div className="relative min-w-0">
          <div className="mx-auto mb-5 flex max-w-[340px] flex-col gap-2">
            <div className="self-start rounded-[14px_14px_14px_4px] border border-ink/10 bg-paper-raised px-3.5 py-[11px] text-[14.5px] leading-[1.4] text-ink/85 shadow-sm">
              {resolvedMessage.text}
            </div>
            <div className="self-end rounded-[14px_14px_4px_14px] bg-pink px-3.5 py-[11px] text-[14.5px] leading-[1.4] text-white">
              Confirm — slip ban gaya.
            </div>
          </div>
          <OrderSlip
            orderNumber="#0148"
            badge="DUE THU"
            rows={SHIFT_ROWS}
            footer={<DotNoteFooter note="FOUND IN THE SAME CHAT — NOW AN ORDER" />}
            animate
            className="mx-auto max-w-[420px]"
          />
        </div>
      </div>
    </section>
  );
}
