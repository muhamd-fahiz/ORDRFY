import { MARKETING_CONFIG } from "@/lib/marketing/content";

export function ClosingCta() {
  return (
    <section id="start" className="bg-pink px-5 py-14 sm:px-14 sm:py-24">
      <div className="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-center gap-7 sm:gap-12">
        <div>
          <h2 className="font-display text-[30px] font-extrabold leading-[0.98] tracking-[-0.04em] text-paper-warm sm:text-[56px]">
            Your next chat
            <br />
            can be an order.
          </h2>
          <p className="mt-5 max-w-[440px] text-[17px] leading-[1.55] text-paper-warm/[0.88]">
            Set it up in one sitting. Free for your first {MARKETING_CONFIG.freeOrders} orders, no card, and you can
            stop any time by telling us on WhatsApp.
          </p>
        </div>
        <div className="flex w-full max-w-[380px] flex-col gap-3">
          <a
            href="#start"
            className="rounded-md bg-ink px-6 py-[18px] text-center font-display text-[15px] font-bold text-paper-warm transition-colors hover:bg-black"
          >
            Start free
          </a>
          <a
            href="#start"
            className="rounded-md border border-paper-warm/60 px-6 py-[18px] text-center font-display text-[15px] font-semibold text-paper-warm transition-colors hover:border-paper-warm"
          >
            Message us on WhatsApp
          </a>
          <div className="flex items-center justify-center gap-2.5 font-data text-[11px] tracking-[0.08em] text-paper-warm/75">
            <span className="grid h-[19px] w-[19px] flex-none place-items-center rounded-full bg-ink leading-none" aria-hidden="true">
              <span className="font-display text-[10px] font-extrabold leading-[0.78] text-paper-warm">o</span>
            </span>
            SET UP IN ENGLISH, HINDI OR HINGLISH
          </div>
        </div>
      </div>
    </section>
  );
}
