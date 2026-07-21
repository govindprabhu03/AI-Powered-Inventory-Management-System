import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Where every authentication flow lands: email confirmation, password reset,
 * and Google/GitHub OAuth.
 *
 * This is a Route Handler (route.ts) rather than a page because it returns a
 * redirect, not HTML. Supabase sends the browser here with a one-time `code`,
 * which we exchange for a real session. The session cookie is written by the
 * server client's setAll handler during the exchange.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Supabase reports failures as query params rather than HTTP errors.
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription ?? error)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Missing authentication code.")}`,
    );
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`,
    );
  }

  // Only allow relative paths. Without this check, a crafted link like
  // /auth/callback?next=https://evil.example would turn our own domain into an
  // open redirect that launders phishing links through a trusted host.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  return NextResponse.redirect(`${origin}${safeNext}`);
}
