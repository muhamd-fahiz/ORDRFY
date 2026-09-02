// Structural placeholder only, per the project owner's own instruction ("add that now the
// setup, then will design best thing there later") -- mirrors Pricing.tsx's own explicit
// "PLACEHOLDER" treatment rather than inventing a company narrative that isn't mine to
// write. Real copy/design pass is a separate, later decision.
export function AboutUs() {
  return (
    <section id="about" className="px-5 py-14 sm:px-14 sm:py-24">
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-3.5 font-data text-[11px] font-bold tracking-[0.16em] text-pink">ABOUT US</div>
        <h2 className="mb-4 max-w-[620px] font-display text-[26px] font-bold leading-[1.06] tracking-[-0.03em] text-paper sm:text-[42px]">
          Our story, coming soon.
        </h2>
        <p className="max-w-[560px] text-[15.5px] leading-[1.55] text-paper/60">
          We&apos;re still writing this section properly — for now, the short version: Ordrfy is built in India, for
          the shops, tutors, bakers and service businesses that already run on WhatsApp.
        </p>
      </div>
    </section>
  );
}
