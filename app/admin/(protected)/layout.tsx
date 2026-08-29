import Link from "next/link";
import { requireReadyAdminSession } from "@/lib/auth/admin-guard";
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
        <nav className="flex flex-wrap items-center gap-4">
          <Link href="/admin/businesses" className="font-display text-sm font-bold">
            Ordrfy Admin
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
