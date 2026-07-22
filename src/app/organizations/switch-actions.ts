"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "@/lib/auth/context";

/**
 * Switch the active organization by storing its id in a cookie.
 *
 * We verify membership server-side before trusting the value — a user could POST
 * any org id here, so the cookie is only set if RLS confirms they belong to it.
 * (Even if a bad value slipped through, requireContext ignores an id that isn't
 * in their memberships, so this is defence in depth.)
 */
export async function setActiveOrg(orgId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !data) {
    return; // not a member — silently ignore
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
}
