import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#verticals", label: "Who it's for" },
  { href: "#pricing", label: "Pricing" },
  { href: "#about", label: "About us" },
];

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3.5 border-b border-paper/[0.09] bg-ink/[0.92] px-5 py-[18px] backdrop-blur sm:px-14">
      <a href="#" aria-label="Ordrfy — home" className="flex items-center gap-2.5">
        <Logo variant="lockup" tone="on-ink" size="md" />
      </a>
      <div className="flex flex-wrap items-center gap-3.5 sm:gap-7">
        {NAV_LINKS.map((link) => (
          <a key={link.href} href={link.href} className="font-app text-sm text-paper/60 transition-colors hover:text-paper">
            {link.label}
          </a>
        ))}
        <Link href="/app/login" className="font-app text-sm text-paper/60 transition-colors hover:text-paper">
          Log in
        </Link>
        <a
          href="#start"
          className="rounded bg-pink px-[18px] py-[11px] font-data text-xs font-bold tracking-[0.06em] text-white transition-colors hover:bg-pink-hover"
        >
          GET STARTED
        </a>
      </div>
    </header>
  );
}
