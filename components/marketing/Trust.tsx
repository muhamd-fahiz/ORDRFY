// Replaces AboutUs.tsx's "coming soon" placeholder
// (docs/architecture/decisions/0039-marketing-homepage-story-redesign.md). All three points
// are honest, already-true claims -- no fake testimonials, no invented statistics, no
// customer logos. The data-safety line is the same claim already made in Faq.tsx's "Is my
// customer data safe?" answer; the no-lock-in line is the same commitment ClosingCta.tsx
// already makes ("stop any time by telling us on WhatsApp"), surfaced here too since it's
// exactly the kind of reassurance this section exists to give. Three points, not two --
// matches the page's own established rhythm (HowItWorks' three steps, Pricing's three
// plans) and gives this section real visual weight instead of two short sentences floating
// in space. Bottom padding is intentionally tighter than the top: this section and Pricing
// immediately after it share the same light background, so full padding on both sides would
// stack into one unbroken gap with nothing to mark where one section ends and the next begins.
const TRUST_POINTS = [
  {
    body: "Ordrfy is built in India, for the shops, tutors, bakers and service businesses that already run their day through WhatsApp and Instagram conversations.",
  },
  {
    body: "Your conversations stay yours. Everything is encrypted, stored in India, and never sold or used to advertise to your customers.",
  },
  {
    body: "No lock-in. If Ordrfy isn't right for you, leave any time — just tell us on WhatsApp. No contracts, no forms.",
  },
];

export function Trust() {
  return (
    <section id="trust" className="bg-paper px-5 pb-10 pt-14 sm:px-14 sm:pb-14 sm:pt-24">
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-3.5 font-data text-[11px] font-bold tracking-[0.16em] text-pink">TRUST</div>
        <h2 className="mb-6 max-w-[640px] font-display text-[26px] font-bold leading-[1.06] tracking-[-0.03em] text-ink sm:mb-9 sm:text-[42px]">
          Nothing about your customers is for sale.
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4 sm:gap-6">
          {TRUST_POINTS.map((point) => (
            <div key={point.body} className="rounded-lg border border-ink/10 bg-paper-raised p-6">
              <p className="text-pretty text-[15.5px] leading-[1.6] text-ink/65">{point.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
