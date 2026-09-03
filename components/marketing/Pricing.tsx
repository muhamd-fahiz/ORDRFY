import type { MARKETING_CONFIG } from "@/lib/marketing/content";
import { getWhatsAppLink } from "@/lib/marketing/whatsapp";

interface PricingProps {
  period?: (typeof MARKETING_CONFIG)["pricingPeriod"];
}

export function Pricing({ period = "per month" }: PricingProps) {
  return (
    <section id="pricing" className="bg-paper px-5 py-14 sm:px-14 sm:py-24">
      <div className="mx-auto max-w-[1240px]">
        <div className="mb-7 sm:mb-10">
          <div className="mb-3.5 font-data text-[11px] font-bold tracking-[0.16em] text-pink">PRICING</div>
          <h2 className="max-w-[600px] font-display text-[26px] font-bold leading-[1.06] tracking-[-0.03em] text-ink sm:text-[42px]">
            Simple plans. Pricing landing soon.
          </h2>
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
            ctaHref={getWhatsAppLink("Hi, I'd like to know more about the Studio plan.")}
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
  /** Defaults to the "#start" anchor-scroll every other plan uses; Studio's "Talk to us" is a WhatsApp deep link instead. */
  ctaHref?: string;
  featured?: boolean;
}

function PlanCard({ title, blurb, period, features, ctaLabel, ctaVariant, ctaHref = "#start", featured = false }: PlanCardProps) {
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
      <div className={`border-b pb-[18px] ${isDark ? "border-paper/[0.14]" : "border-ink/[0.12]"}`}>
        <div className={`font-display text-[15px] font-bold ${isDark ? "text-paper" : "text-ink"}`}>Early access</div>
        <p className={`mt-1 text-[12.5px] leading-[1.4] ${isDark ? "text-paper/55" : "text-ink/55"}`}>
          Locked in at today&apos;s rate, billed {period}, once pricing launches.
        </p>
      </div>
      <div className={`my-[18px] grid gap-2.5 text-[15px] ${isDark ? "text-paper/[0.78]" : "text-ink/70"}`}>
        {features.map((feature) => (
          <div key={feature}>{feature}</div>
        ))}
      </div>
      <a
        href={ctaHref}
        {...(ctaHref.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
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
