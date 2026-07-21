"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import {
  loginSchema,
  signupSchema,
  resetRequestSchema,
  type AuthActionState,
} from "@/lib/validation/auth";

/**
 * Server Actions for authentication.
 *
 * "use server" at the top of the file marks every export as a Server Action.
 * These are reachable by direct POST — not just through our forms — so each one
 * re-validates its input rather than trusting the client.
 *
 * Note: `redirect()` works by throwing a special error that Next.js catches.
 * It must therefore be called OUTSIDE any try/catch, or the catch block will
 * swallow the redirect and it will silently do nothing.
 */

/** The site's own origin, used to build absolute callback URLs. */
async function getOrigin() {
  const headerList = await headers(); // async in Next.js 16
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    headerList.get("origin") ??
    `https://${headerList.get("host")}`
  );
}

export async function signup(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const origin = await getOrigin();

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Read by the handle_new_user trigger to populate profiles.full_name.
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success:
      "Check your email for a confirmation link to finish creating your account.",
  };
}

export async function login(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Deliberately generic. Saying "no account with that email" would let an
    // attacker discover which addresses are registered.
    return { error: "Invalid email or password." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard"); // outside any try/catch — see note above
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login");
}

export async function requestPasswordReset(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const origin = await getOrigin();

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/account/password`,
  });

  // Always report success, even if no such account exists — otherwise this
  // endpoint becomes a way to enumerate registered email addresses.
  return {
    success: "If that email is registered, a reset link is on its way.",
  };
}

/**
 * OAuth is a redirect flow: we ask Supabase for the provider's URL, then send
 * the browser there. The provider returns the user to /auth/callback.
 */
export async function signInWithOAuth(provider: "google" | "github") {
  const supabase = await createClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "OAuth failed")}`);
  }

  redirect(data.url);
}
