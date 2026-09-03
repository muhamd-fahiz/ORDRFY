// Reframed from problem-framed ("the four things that go wrong") to outcome-framed
// (docs/architecture/decisions/0039-marketing-homepage-story-redesign.md) -- the CHAOS beat
// now lives earlier (ProblemRecognition), so naming the same problems again here would be
// redundant. This section is the payoff recap instead: what you get back, in the same four
// real categories the product already covers.
const CARDS = [
  { number: "01", title: "Order book", body: "Every order remembered and sorted by what's due next — nothing lives only in a chat thread anymore." },
  { number: "02", title: "Follow-ups", body: "Trials, pickups, classes and deliveries — nudges go out on time, without you tracking the dates yourself." },
  { number: "03", title: "Payments", body: "Advance taken, balance pending, who still owes you — counted per order and per month, without the mental math." },
  { number: "04", title: "Customer memory", body: "Sizes, flavours, past orders and repeat dates — remembered for you, even on a day you're not thinking straight." },
];

export function WhatItHandles() {
  return (
    <section className="px-5 py-14 sm:px-14 sm:py-24">
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-3.5 font-data text-[11px] font-bold tracking-[0.16em] text-pink">WHAT YOU GET BACK</div>
        <h2 className="mb-8 max-w-[640px] font-display text-[26px] font-bold leading-[1.06] tracking-[-0.03em] text-paper sm:mb-11 sm:text-[42px]">
          What changes once the chaos is organized.
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
