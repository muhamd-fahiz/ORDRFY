const CARDS = [
  { number: "01", title: "Order book", body: "Every order as a slip, sorted by delivery date. Nothing lives only in a chat thread." },
  { number: "02", title: "Reminders", body: "Trials, pickups, classes and deliveries — nudges to you and to the customer, on time." },
  { number: "03", title: "Payments", body: "Advance taken, balance pending, who still owes you — counted per order and per month." },
  { number: "04", title: "Customer list", body: "Sizes, flavours, past orders and repeat dates — the memory your notebook never had." },
];

export function WhatItHandles() {
  return (
    <section className="px-5 py-14 sm:px-14 sm:py-24">
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-3.5 font-data text-[11px] font-bold tracking-[0.16em] text-pink">WHAT IT HANDLES</div>
        <h2 className="mb-8 max-w-[640px] font-display text-[26px] font-bold leading-[1.06] tracking-[-0.03em] text-paper sm:mb-11 sm:text-[42px]">
          The four things that go wrong when the shop gets busy.
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,270px),1fr))] gap-4 sm:gap-[22px]">
          {CARDS.map((card) => (
            <div key={card.number} className="rounded-lg border border-paper/10 bg-paper/[0.04] p-6">
              <div className="mb-3.5 font-data text-[26px] font-bold text-pink">{card.number}</div>
              <div className="mb-2.5 font-display text-base font-bold text-paper">{card.title}</div>
              <p className="text-[15px] leading-[1.55] text-paper/60">{card.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
