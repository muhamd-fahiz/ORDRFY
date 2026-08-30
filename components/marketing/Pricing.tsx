import type { MARKETING_CONFIG } from "@/lib/marketing/content";

interface PricingProps {
  period?: (typeof MARKETING_CONFIG)["pricingPeriod"];
}

export function Pricing({ period = "per month" }: PricingProps) {
  return (
    <section id="pricing" className="bg-paper px-5 py-14 sm:px-14 sm:py-24">
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-7 flex flex-wrap items-baseline justify-between gap-4 sm:mb-10">
          <div>
            <div className="mb-3.5 font-data text-[11px] font-bold tracking-[0.16em] text-pink">PRICING</div>
            <h2 className="max-w-[600px] font-display text-[26px] font-bold leading-[1.06] tracking-[-0.03em] text-ink sm:text-[42px]">
              Three plans. Numbers being finalised.
            </h2>
          </div>
          <div className="border-2 border-dashed border-ink/30 px-[13px] py-[9px] font-data text-[11px] font-bold tracking-[0.1em] text-ink">
            PLACEHOLDER · ₹ TBD
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,270px),1fr))] items-start gap-4 sm:gap-6">
          <PlanCard
            title="Starter"
            blurb="Just started taking orders in chat."
            period={period}
            features={["Up to 50 orders a month", "1 WhatsApp number", "Order slips + reminders"]}
            ctaLabel="Start free"
            ctaVariant="outline"
          />
          <PlanCard
            title="Shop"
            blurb="A steady book of daily orders."
            period={period}
            features={["Unlimited orders", "WhatsApp + Instagram", "Payment tracking + follow-ups", "Customer history"]}
            ctaLabel="Start free"
            ctaVariant="filled"
            featured
          />
          <PlanCard
            title="Studio"
            blurb="A team, two shops, or both."
            period={period}
            features={["Multiple businesses", "Staff accounts", "Reports + exports", "Priority support"]}
            ctaLabel="Talk to us"
            ctaVariant="outline"
          />
        </div>

        <p className="mt-6 font-data text-[11.5px] tracking-[0.06em] text-ink/50">
          FINAL PRICES LANDING SOON · EARLY SHOPS KEEP THEIR RATE
        </p>
      </div>
    </section>
  );
}

interface PlanCardProps {
  title: string;
  blurb: string;
  period: string;
  features: string[];
  ctaLabel: string;
  ctaVariant: "outline" | "filled";
  featured?: boolean;
}

function PlanCard({ title, blurb, period, features, ctaLabel, ctaVariant, featured = false }: PlanCardProps) {
  const isDark = featured;
  return (
    <div
      className={`rounded-md p-[26px] ${
        isDark ? "border border-ink bg-ink shadow-[8px_8px_0_#E0117F]" : "border border-ink/[0.14] bg-paper-raised"
      }`}
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className={`font-display text-[17px] font-bold ${isDark ? "text-paper" : "text-ink"}`}>{title}</div>
        {featured && (
          <span className="rounded-[3px] bg-pink px-2 py-[5px] font-data text-[10px] font-bold tracking-[0.1em] text-white">POPULAR</span>
        )}
      </div>
      <p className={`mb-5 mt-2 text-[14.5px] leading-[1.5] ${isDark ? "text-paper/60" : "text-ink/60"}`}>{blurb}</p>
      <div className={`flex flex-wrap items-baseline gap-2 border-b pb-[18px] ${isDark ? "border-paper/[0.14]" : "border-ink/[0.12]"}`}>
        <span className={`font-data text-[36px] font-bold ${isDark ? "text-paper/35" : "text-ink/25"}`}>₹—</span>
        <span className={`font-data text-[11px] tracking-[0.08em] ${isDark ? "text-paper/45" : "text-ink/45"}`}>{period}</span>
      </div>
      <div className={`my-[18px] grid gap-2.5 text-[15px] ${isDark ? "text-paper/[0.78]" : "text-ink/70"}`}>
        {features.map((feature) => (
          <div key={feature}>{feature}</div>
        ))}
      </div>
      <a
        href="#start"
        className={`block rounded-[5px] p-[13px] text-center font-display text-[13.5px] transition-colors ${
          ctaVariant === "filled"
            ? "bg-pink font-bold text-white hover:bg-pink-hover"
            : "border border-ink/20 font-semibold text-ink hover:border-pink hover:text-pink"
        }`}
      >
        {ctaLabel}
      </a>
    </div>
  );
}
