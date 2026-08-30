const STEPS = [
  {
    number: "01",
    title: "Connect your chats",
    body: "Link WhatsApp Business and your Instagram inbox. Takes a few minutes, no new app for your customers.",
  },
  {
    number: "02",
    title: "Ordrfy writes the slip",
    body: "Item, quantity, date, advance, balance — pulled out of the conversation. You glance at it and confirm.",
  },
  {
    number: "03",
    title: "Reminders go out",
    body: "Delivery dates, trial dates, pending balances — Ordrfy follows up on WhatsApp so you don't have to remember.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="bg-paper px-5 py-14 sm:px-14 sm:py-24">
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-3.5 font-data text-[11px] font-bold tracking-[0.16em] text-pink">HOW IT WORKS</div>
        <h2 className="mb-8 max-w-[620px] font-display text-[26px] font-bold leading-[1.06] tracking-[-0.03em] text-ink sm:mb-12 sm:text-[42px]">
          Three steps, then it runs in the background.
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-5 sm:gap-7">
          {STEPS.map((step) => (
            <div key={step.number} className="border-t-2 border-ink pt-5">
              <div className="mb-3.5 font-data text-xs font-bold tracking-[0.12em] text-pink">{step.number}</div>
              <div className="mb-2.5 font-display text-[17px] font-bold leading-tight tracking-[-0.02em] text-ink">{step.title}</div>
              <p className="text-[15.5px] leading-[1.55] text-ink/[0.62]">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
