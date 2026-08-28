import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/** RLS-scoped client for Client Components. Uses the anon key only -- never the service role. */
export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
