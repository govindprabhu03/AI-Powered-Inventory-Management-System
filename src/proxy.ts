import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every matched request.
 *
 * In Next.js 16 this file was renamed from `middleware.ts` to `proxy.ts`, and
 * the exported function from `middleware` to `proxy`. Tutorials written before
 * that rename will not work here.
 *
 * Its job: Supabase access tokens are short-lived. Server Components are not
 * allowed to write cookies, so they cannot refresh an expired token themselves.
 * This proxy refreshes it and writes the new cookie on both the request (so the
 * Server Component about to render sees it) and the response (so the browser
 * stores it).
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not put code between createServerClient and getClaims(). Anything that
  // runs in between can cause the session to be dropped at random, producing
  // logouts that are near-impossible to reproduce.
  //
  // getClaims() verifies the JWT signature. getSession() does not — it trusts
  // the cookie, which a client can forge. Never authorize on getSession().
  await supabase.auth.getClaims();

  // Route protection is added in Phase 1, once login pages exist.

  // Must return this exact object. Constructing a fresh NextResponse here would
  // silently discard the refreshed auth cookies set above.
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match everything except static assets and image files. Without this the
     * proxy would also run on CSS, JS and images — slow, and a common cause of
     * auth redirects accidentally blocking stylesheets.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
