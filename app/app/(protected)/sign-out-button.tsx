"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/db/browser";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/app/login");
    router.refresh();
  }

  return (
    <button onClick={handleSignOut} className="font-app text-xs text-ink-40 underline hover:text-ink">
      Sign out
    </button>
  );
}
