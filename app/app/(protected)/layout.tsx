import Link from "next/link";
import { requireReadyOwnerSession } from "@/lib/auth/owner-guard";
import { ordrfyFontVariables } from "@/lib/design/fonts";
import { Logo } from "@/components/ui/Logo";
import { Copyright } from "@/components/ui/Copyright";
import { SignOutButton } from "./sign-out-button";

export default async function ProtectedOwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireReadyOwnerSession();

  return (
    <div className={`${ordrfyFontVariables} min-h-screen bg-paper font-app text-ink`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-15 px-4 py-3">
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/app/today" aria-label="Ordrfy — home">
            <Logo variant="lockup" tone="on-paper" size="md" />
          </Link>
          <Link href="/app/today" className="font-app text-xs text-ink-70 hover:text-ink">
            Today
          </Link>
          <Link href="/app/contacts" className="font-app text-xs text-ink-70 hover:text-ink">
            Customers
          </Link>
          <Link href="/app/attention" className="font-app text-xs text-ink-70 hover:text-ink">
            Attention
          </Link>
          <Link href="/app/payments" className="font-app text-xs text-ink-70 hover:text-ink">
            Payments
          </Link>
          <Link href="/app/settings" className="font-app text-xs text-ink-70 hover:text-ink">
            Settings
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <span className="font-app text-xs text-ink-40">{session.businessName}</span>
          <SignOutButton />
        </div>
      </header>
      <main>{children}</main>
      <footer className="px-4 py-6">
        <Copyright tone="on-paper" />
      </footer>
    </div>
  );
}
