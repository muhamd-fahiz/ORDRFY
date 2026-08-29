import Link from "next/link";
import { requireReadyOwnerSession } from "@/lib/auth/owner-guard";
import { ordrfyFontVariables } from "@/lib/design/fonts";
import { SignOutButton } from "./sign-out-button";

export default async function ProtectedOwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireReadyOwnerSession();

  return (
    <div className={`${ordrfyFontVariables} min-h-screen bg-paper font-app text-ink`}>
      <header className="flex items-center justify-between border-b border-ink-15 px-4 py-3">
        <nav className="flex items-center gap-4">
          <span className="font-display text-sm font-bold">Ordrfy</span>
          <Link href="/app/today" className="font-app text-xs text-ink-70 hover:text-ink">
            Today
          </Link>
          <Link href="/app/contacts" className="font-app text-xs text-ink-70 hover:text-ink">
            Contacts
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <span className="font-app text-xs text-ink-40">{session.businessName}</span>
          <SignOutButton />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
