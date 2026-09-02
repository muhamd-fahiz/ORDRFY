import Link from "next/link";
import { requireReadyAdminSession } from "@/lib/auth/admin-guard";
import { Logo } from "@/components/ui/Logo";
import { Copyright } from "@/components/ui/Copyright";
import { SignOutButton } from "./sign-out-button";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireReadyAdminSession();

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-15 px-4 py-4 sm:px-8 sm:py-5 lg:px-12 lg:py-6">
        <nav className="flex flex-wrap items-center gap-6 lg:gap-8">
          <Link href="/admin/businesses" aria-label="Ordrfy — home" className="flex items-center gap-2.5">
            <Logo variant="lockup" tone="on-paper" size="md" />
            <span className="rounded-[3px] bg-ink-15 px-1.5 py-0.5 font-data text-[10px] font-bold tracking-[0.1em] text-ink-70">
              ADMIN
            </span>
          </Link>
          <Link href="/admin/businesses" className="font-app text-base text-ink-70 hover:text-ink lg:text-lg">
            Businesses
          </Link>
          <Link href="/admin/settings" className="font-app text-base text-ink-70 hover:text-ink lg:text-lg">
            Settings
          </Link>
        </nav>
        <div className="flex items-center gap-5">
          <span className="font-app text-base text-ink-40 lg:text-lg">{session.adminName}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="p-4 sm:p-8 lg:p-12 xl:p-16">{children}</main>
      <footer className="px-4 py-6 sm:px-8 lg:px-12">
        <Copyright tone="on-paper" />
      </footer>
    </div>
  );
}
