"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/db/browser";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <button onClick={handleSignOut} className="font-app text-sm text-ink-70 underline hover:text-ink">
      Sign out
    </button>
  );
}
