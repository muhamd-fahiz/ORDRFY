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
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/admin/businesses" className="font-semibold">
            Ordrfy Admin
          </Link>
          <Link href="/admin/businesses" className="text-neutral-600 hover:text-neutral-900">
            Businesses
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span>{session.adminName}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
