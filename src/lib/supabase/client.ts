import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";

/**
 * Supabase client for Client Components ("use client").
 *
 * Runs in the browser, so it may only ever use the publishable key.
 * Every query it makes is subject to Row Level Security — the database,
 * not this file, is what stops one organization reading another's data.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
