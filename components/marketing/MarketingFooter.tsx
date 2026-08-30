import { Logo } from "@/components/ui/Logo";

const FOOTER_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#verticals", label: "Who it's for" },
  { href: "#pricing", label: "Pricing" },
  { href: "#start", label: "Contact" },
];

export function MarketingFooter() {
  return (
    <footer className="px-5 py-9 sm:px-14 sm:py-14">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-baseline justify-between gap-5">
        <Logo variant="wordmark" tone="on-ink" size="md" tagline />
        <div className="flex flex-wrap gap-4 text-sm sm:gap-6">
          {FOOTER_LINKS.map((link) => (
            <a key={link.label} href={link.href} className="text-paper/55 transition-colors hover:text-pink">
              {link.label}
            </a>
          ))}
        </div>
        <div className="font-data text-[11px] tracking-[0.08em] text-paper/35">ORDRFY.IN · MADE IN INDIA</div>
      </div>
    </footer>
  );
}
