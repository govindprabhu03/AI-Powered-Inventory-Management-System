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
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);

  const { pathname } = request.nextUrl;
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const isAuthPage = AUTH_PAGES.includes(pathname);

  // Signed out, asking for a protected page -> send to login, remembering where
  // they were headed so we can return them after signing in.
  if (!isAuthenticated && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Signed in, asking for login/signup -> nothing to do there.
  if (isAuthenticated && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // This check is a convenience, not the security boundary. It only inspects a
  // cookie and can be bypassed by calling a Server Action directly. Row Level
  // Security in Postgres is what actually protects the data.

  // Must return this exact object. Constructing a fresh NextResponse here would
  // silently discard the refreshed auth cookies set above.
  return supabaseResponse;
}

/** Reachable without signing in. Everything else requires a session. */
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/auth",
];

/** Pointless to visit while already signed in. */
const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

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
