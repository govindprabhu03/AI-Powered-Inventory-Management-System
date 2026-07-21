import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * `cookies()` is async in Next.js 16 — hence the `await` and the async function.
 * Because of that, every caller must `await createClient()`.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot write cookies. This is expected and safe
            // to ignore *only* because proxy.ts refreshes the session on every
            // request — that is where the refreshed cookie actually gets set.
          }
        },
      },
    },
  );
}
