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
    <button onClick={handleSignOut} className="underline hover:text-neutral-900">
      Sign out
    </button>
  );
}
