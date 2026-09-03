const EXAMPLES = {
  handled: {
    label: "HANDLED AUTOMATICALLY",
    customer: "Blue wale mein price kya hai?",
    reply: "₹1,700, stitching included. Ready in 3 days.",
  },
  flagged: {
    label: "FLAGGED FOR YOU",
    customer: "Kal tak ho sakta hai kya, urgent hai?",
    note: "Ordrfy wasn't sure about this one — it's waiting for your reply, not answered for you.",
  },
};

/**
 * The CONTROL beat (docs/architecture/decisions/0039-marketing-homepage-story-redesign.md).
 * Grounded ONLY in what actually ships today -- the real owner_attention_queue/kill-switch
 * behavior, translated into plain language with none of the internal vocabulary (no
 * "classification," "confidence," "human-in-the-loop"). Deliberately does not describe or
 * imply per-contact takeover (ADR-0028), which isn't built.
 *
 * Reuses the product's own existing color meanings rather than inventing new ones: confirmed
 * (green) already means "handled/done" in the owner app; attention (amber) already means
 * "needs you" in the owner app's own Needs Attention banners. Same meaning, same colors, here.
 */
export function AutomationControl() {
  return (
    <section id="control" className="px-5 py-14 sm:px-14 sm:py-24">
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-3.5 font-data text-[11px] font-bold tracking-[0.16em] text-pink">AUTOMATION + CONTROL</div>
        <h2 className="mb-4 max-w-[640px] font-display text-[26px] font-bold leading-[1.06] tracking-[-0.03em] text-paper sm:text-[42px]">
          The routine stuff, handled.
          <br />
          The rest, flagged for you.
        </h2>
        <p className="mb-10 max-w-[560px] text-pretty text-[16.5px] leading-[1.6] text-paper/[0.62] sm:mb-14">
          Ordrfy answers the questions it recognizes — the ones you&apos;d answer the same way every time. Anything
          it isn&apos;t sure about is set aside for you, never guessed. You can pause all of it, any time.
        </p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-6">
          <div className="rounded-lg border border-confirmed/30 bg-confirmed/[0.08] p-6">
            <div className="mb-4 inline-block rounded-[3px] bg-confirmed px-2.5 py-1.5 font-data text-[10.5px] font-bold tracking-[0.08em] text-white">
              {EXAMPLES.handled.label}
            </div>
            <div className="mb-3 rounded-[14px_14px_14px_4px] border border-paper/10 bg-ink-raised px-3.5 py-[11px] text-[14px] leading-[1.4] text-paper/90">
              {EXAMPLES.handled.customer}
            </div>
            <div className="rounded-[14px_14px_4px_14px] bg-confirmed px-3.5 py-[11px] text-[14px] leading-[1.4] text-white">
              {EXAMPLES.handled.reply}
            </div>
          </div>
          <div className="rounded-lg border border-attention/40 bg-attention/[0.1] p-6">
            <div className="mb-4 inline-block rounded-[3px] bg-attention px-2.5 py-1.5 font-data text-[10.5px] font-bold tracking-[0.08em] text-white">
              {EXAMPLES.flagged.label}
            </div>
            <div className="mb-3 rounded-[14px_14px_14px_4px] border border-paper/10 bg-ink-raised px-3.5 py-[11px] text-[14px] leading-[1.4] text-paper/90">
              {EXAMPLES.flagged.customer}
            </div>
            <p className="text-[13.5px] leading-[1.5] text-paper/55">{EXAMPLES.flagged.note}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
