import { CarbonCopyFooter, OrderSlip } from "./OrderSlip";
import { MARKETING_CONFIG } from "@/lib/marketing/content";

const HERO_ROWS = [
  { label: "CUSTOMER", value: "Meena · +91 98••• 41•2" },
  { label: "ITEM", value: "Kurta set — blue × 2" },
  { label: "ADVANCE", value: "₹500 ✓", mono: true },
  { label: "BALANCE", value: "₹1,700", mono: true, pink: true },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden px-5 py-11 sm:px-14 sm:py-16 md:py-[88px]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:22px_22px]"
        aria-hidden="true"
      />
      <div className="relative mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(min(100%,390px),1fr))] items-center gap-10 md:gap-16">
        <div>
          <div className="mb-5 font-data text-[11px] font-bold tracking-[0.16em] text-pink sm:text-[11.5px]">
            SLIP NO. 001 — WHATSAPP + INSTAGRAM
          </div>
          <h1 className="font-display text-[38px] font-extrabold leading-[0.94] tracking-[-0.04em] text-paper sm:text-[70px]">
            Chats in.
            <br />
            <span className="text-pink">Orders out.</span>
          </h1>
          <p className="mt-[22px] max-w-[460px] text-pretty text-[16px] leading-[1.55] text-paper/[0.64] sm:text-[18px]">
            Ordrfy reads your WhatsApp and Instagram conversations and turns them into organized orders, delivery
            reminders and payment tracking. No spreadsheets. No missed advances.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#start"
              className="rounded-md bg-pink px-[26px] py-4 font-display text-sm font-bold text-white transition-colors hover:bg-pink-hover"
            >
              Start free
            </a>
            <a
              href="#start"
              className="rounded-md border border-paper/[0.28] px-[26px] py-4 font-display text-sm font-semibold text-paper transition-colors hover:border-paper"
            >
              See it on WhatsApp
            </a>
          </div>
          <div className="mt-6 flex items-center gap-2.5 font-data text-[11.5px] tracking-[0.04em] text-paper/[0.42]">
            <span className="h-[7px] w-[7px] flex-none rounded-full bg-pink" aria-hidden="true" />
            FREE FOR YOUR FIRST {MARKETING_CONFIG.freeOrders} ORDERS · NO CARD
          </div>
        </div>

        <div className="relative min-w-0">
          <div className="mx-auto mb-5 flex max-w-[340px] flex-col gap-2">
            <div className="self-start rounded-[14px_14px_14px_4px] border border-paper/10 bg-ink-raised px-3.5 py-[11px] text-[14.5px] leading-[1.4] text-paper/90">
              Didi 2 kurta set chahiye, blue wala. Friday tak?
            </div>
            <div className="self-end rounded-[14px_14px_4px_14px] bg-pink px-3.5 py-[11px] text-[14.5px] leading-[1.4] text-white">
              Ho jayega. ₹500 advance bhej dena
            </div>
          </div>
          <div className="mb-4 flex items-center gap-2.5 font-data text-[10.5px] tracking-[0.14em] text-paper/40">
            <span className="h-px flex-1 bg-paper/[0.14]" aria-hidden="true" />
            <span className="grid h-[19px] w-[19px] flex-none place-items-center rounded-[5px] bg-pink leading-none">
              <span className="font-display text-[10px] font-extrabold leading-[0.78] text-paper-warm">o</span>
            </span>
            ORDRFY WRITES THE SLIP
            <span className="h-px flex-1 bg-paper/[0.14]" aria-hidden="true" />
          </div>
          <OrderSlip
            orderNumber="#0142"
            badge="DUE FRI"
            rows={HERO_ROWS}
            footer={<CarbonCopyFooter />}
            className="mx-auto max-w-[420px]"
          />
        </div>
      </div>
    </section>
  );
}
