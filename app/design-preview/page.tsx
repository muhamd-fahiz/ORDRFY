import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { ContactCard } from "@/components/ui/ContactCard";
import { VerticalBadge } from "@/components/ui/VerticalBadge";
import { AttentionBanner } from "@/components/ui/AttentionBanner";
import type { VerticalKey } from "@/lib/design/verticals";

const ALL_VERTICALS: VerticalKey[] = ["fashion", "tutor", "service", "baker", "gift"];

export default function DesignPreviewPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-8">
      <p className="mb-1 font-data text-[0.65rem] uppercase tracking-widest text-ink-40">
        Component library preview
      </p>
      <h1 className="mb-6 font-display text-2xl font-bold">
        Chats in. <span className="text-pink">Orders out.</span>
      </h1>

      <section aria-labelledby="today-heading" className="mb-10 rounded-2xl border border-ink-15 bg-paper-raised p-4">
        <div className="mb-3 flex items-center justify-between">
          <VerticalBadge vertical="fashion" variant="icon" />
        </div>
        <h2 id="today-heading" className="mb-2 font-app text-xs font-semibold uppercase tracking-wide text-ink-40">
          Today
        </h2>

        <div className="mb-3">
          <AttentionBanner count={3} />
        </div>

        <div className="flex flex-col gap-2">
          <ContactCard
            name="Priya K."
            timeLabel="2d ago"
            message={'"Is the blue kurta ready yet?"'}
            stageChip={<Chip tone="neutral">New Inquiry</Chip>}
            action={<Button variant="primary" size="sm">Send Reminder</Button>}
          />
          <ContactCard
            name="Rahul S."
            timeLabel="09:12"
            message={'"Payment done, thank you!"'}
            stageChip={<Chip tone="confirmed">Order Confirmed</Chip>}
            action={<Button variant="primary" size="sm">Mark Paid</Button>}
          />
        </div>
      </section>

      <section aria-labelledby="verticals-heading" className="mb-10">
        <h2 id="verticals-heading" className="mb-3 font-app text-xs font-semibold uppercase tracking-wide text-ink-40">
          Vertical accents (data-driven, not branched)
        </h2>
        <div className="flex flex-col gap-2 rounded-2xl border border-ink-15 bg-paper-raised p-4">
          {ALL_VERTICALS.map((v) => (
            <VerticalBadge key={v} vertical={v} variant="dot" />
          ))}
        </div>
      </section>

      <section aria-labelledby="buttons-heading" className="mb-10">
        <h2 id="buttons-heading" className="mb-3 font-app text-xs font-semibold uppercase tracking-wide text-ink-40">
          Buttons
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
      </section>

      <section aria-labelledby="chips-heading">
        <h2 id="chips-heading" className="mb-3 font-app text-xs font-semibold uppercase tracking-wide text-ink-40">
          Chips
        </h2>
        <div className="flex flex-wrap gap-2">
          <Chip tone="neutral">New Inquiry</Chip>
          <Chip tone="confirmed">Order Confirmed</Chip>
          <Chip tone="attention">Needs Attention</Chip>
        </div>
      </section>
    </main>
  );
}
