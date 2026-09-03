import { ScatteredMessages } from "./ScatteredMessages";
import { CHAOS_MESSAGES } from "@/lib/marketing/content";

/**
 * The CHAOS beat (docs/architecture/decisions/0039-marketing-homepage-story-redesign.md).
 * Deliberately does not mention Ordrfy at all -- the visitor should recognize their own day
 * first, before any product is introduced. Every line here is written to pass the "would a
 * shop owner who's never used business software understand this immediately" test: no
 * mention of messages being "unstructured," no "conversations," no product language at all,
 * just the plain, specific things that actually happen.
 */
export function ProblemRecognition() {
  return (
    <section id="chaos" className="px-5 py-14 sm:px-14 sm:py-24">
      <div className="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] items-center gap-10 md:gap-16">
        <div>
          <div className="mb-3.5 font-data text-[11px] font-bold tracking-[0.16em] text-pink">SOUND FAMILIAR?</div>
          <h2 className="mb-5 font-display text-[30px] font-bold leading-[1.02] tracking-[-0.03em] text-paper sm:text-[48px]">
            Too many chats.
            <br />
            Not enough hands.
          </h2>
          <p className="max-w-[440px] text-pretty text-[16.5px] leading-[1.6] text-paper/[0.62]">
            The same question, five times a day. An order confirmed somewhere in a chat you can&apos;t find again. A
            customer who messaged and never heard back. None of it is your fault — there&apos;s just too much of it
            to hold in your head.
          </p>
        </div>
        <div>
          <div className="mb-4 font-data text-[10.5px] tracking-[0.14em] text-paper/40">A NORMAL TUESDAY ON WHATSAPP</div>
          <ScatteredMessages
            messages={CHAOS_MESSAGES}
            voiceMessage={{ from: "Karan", duration: "0:14" }}
            moreCount={12}
          />
        </div>
      </div>
    </section>
  );
}
