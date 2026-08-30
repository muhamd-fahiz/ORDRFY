import Link from "next/link";
import { requireReadyAdminSession } from "@/lib/auth/admin-guard";
import { Logo } from "@/components/ui/Logo";
import { SignOutButton } from "./sign-out-button";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireReadyAdminSession();

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-15 px-4 py-3">
        <nav className="flex flex-wrap items-center gap-3">
          <Link href="/admin/businesses" aria-label="Ordrfy — home" className="flex items-center gap-2">
            <Logo variant="lockup" tone="on-paper" size="md" />
            <span className="rounded-[3px] bg-ink-15 px-1.5 py-0.5 font-data text-[10px] font-bold tracking-[0.1em] text-ink-70">
              ADMIN
            </span>
          </Link>
          <Link href="/admin/businesses" className="font-app text-xs text-ink-70 hover:text-ink">
            Businesses
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <span className="font-app text-xs text-ink-40">{session.adminName}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
