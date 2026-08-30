"use client";

import { useState, type KeyboardEvent } from "react";
import { DotNoteFooter, OrderSlip } from "./OrderSlip";
import { MARKETING_VERTICALS } from "@/lib/marketing/content";

export function VerticalsShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  // activeIndex is always kept in [0, MARKETING_VERTICALS.length) by setActiveIndex's own
  // callers (modulo arithmetic in the arrow-key handler, direct tab indices elsewhere) --
  // the non-null assertion reflects that invariant, which noUncheckedIndexedAccess can't see.
  const active = MARKETING_VERTICALS[activeIndex]!;

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const next = (index + 1) % MARKETING_VERTICALS.length;
      setActiveIndex(next);
      document.getElementById(`vertical-tab-${next}`)?.focus();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const prev = (index - 1 + MARKETING_VERTICALS.length) % MARKETING_VERTICALS.length;
      setActiveIndex(prev);
      document.getElementById(`vertical-tab-${prev}`)?.focus();
    }
  }

  return (
    <section id="verticals" className="border-b border-paper/[0.08] px-5 py-14 sm:px-14 sm:py-24">
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-3.5 font-data text-[11px] font-bold tracking-[0.16em] text-pink">ONE PAD, FIVE KINDS OF SHOP</div>
        <h2 className="mb-2 max-w-[700px] font-display text-[26px] font-bold leading-[1.06] tracking-[-0.03em] text-paper sm:text-[42px]">
          Pick your trade. The slip rewrites itself.
        </h2>
        <p className="mb-8 max-w-[520px] text-[16.5px] leading-[1.55] text-paper/55 sm:mb-9">
          Same order book underneath — different fields, dates and reminders for each business.
        </p>

        <div role="tablist" aria-label="Business type" className="mb-8 flex flex-wrap gap-2.5 sm:mb-9">
          {MARKETING_VERTICALS.map((vertical, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={vertical.key}
                id={`vertical-tab-${index}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`vertical-panel-${index}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveIndex(index)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
                className={`rounded-full border px-[18px] py-3 font-display text-[13.5px] font-semibold transition-colors hover:border-pink ${
                  isActive ? "border-pink bg-pink text-white" : "border-paper/20 bg-transparent text-paper/60"
                }`}
              >
                {vertical.tab}
              </button>
            );
          })}
        </div>

        <div
          id={`vertical-panel-${activeIndex}`}
          role="tabpanel"
          aria-labelledby={`vertical-tab-${activeIndex}`}
          className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-10 sm:gap-14"
        >
          <div>
            <h3 className="max-w-[460px] font-display text-[22px] font-bold leading-[1.12] tracking-[-0.03em] text-paper sm:text-[31px]">
              {active.tag}
            </h3>
            <p className="mt-[18px] max-w-[470px] text-pretty text-[16.5px] leading-[1.6] text-paper/[0.62]">{active.valueProp}</p>
            <div className="mt-[26px] flex flex-wrap gap-2">
              {active.tracks.map((track) => (
                <span
                  key={track}
                  className="rounded-[3px] border border-paper/[0.18] bg-paper/[0.03] px-3 py-2 font-data text-[11px] font-bold uppercase tracking-[0.08em] text-paper/70"
                >
                  {track}
                </span>
              ))}
            </div>
            <div className="mt-[30px] max-w-[400px] rounded-[14px_14px_14px_4px] border border-paper/10 bg-ink-raised px-[15px] py-3">
              <div className="mb-1.5 font-data text-[10px] font-bold tracking-[0.14em] text-paper/35">CUSTOMER, IN CHAT</div>
              <div className="text-[15px] leading-[1.45] text-paper/[0.92]">{active.chat}</div>
            </div>
          </div>

          <OrderSlip
            key={active.key}
            orderNumber={`#01${42 - activeIndex}`}
            badge={active.badge}
            rows={active.rows.map((row) => ({ label: row.label, value: row.value, mono: row.mono, pink: row.pink }))}
            footer={<DotNoteFooter note={active.foot} />}
            animate
            className="w-full max-w-[440px]"
          />
        </div>
      </div>
    </section>
  );
}
