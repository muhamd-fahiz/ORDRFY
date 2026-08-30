"use client";

import { useId, useState } from "react";
import { MARKETING_FAQS } from "@/lib/marketing/content";

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number>(0);
  const baseId = useId();

  return (
    <section className="px-5 py-14 sm:px-14 sm:py-24">
      <div className="mx-auto max-w-[900px]">
        <div className="mb-3.5 font-data text-[11px] font-bold tracking-[0.16em] text-pink">QUESTIONS</div>
        <h2 className="mb-6 font-display text-[26px] font-bold leading-[1.06] tracking-[-0.03em] text-paper sm:mb-9 sm:text-4xl">
          Before you connect your inbox.
        </h2>
        <div className="grid">
          {MARKETING_FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            const answerId = `${baseId}-answer-${index}`;
            const questionId = `${baseId}-question-${index}`;
            return (
              <div key={faq.question} className="border-t border-paper/[0.13]">
                <button
                  type="button"
                  id={questionId}
                  aria-expanded={isOpen}
                  aria-controls={answerId}
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  className="flex w-full items-baseline justify-between gap-4 py-5 text-left font-app text-base font-semibold text-paper transition-colors hover:text-pink sm:text-[18.5px]"
                >
                  <span>{faq.question}</span>
                  <span className="flex-none font-data text-xl text-pink" aria-hidden="true">
                    {isOpen ? "–" : "+"}
                  </span>
                </button>
                {isOpen && (
                  <p id={answerId} role="region" aria-labelledby={questionId} className="mb-[22px] mt-[-6px] max-w-[640px] text-base leading-[1.6] text-paper/60">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
