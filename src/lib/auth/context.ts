import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type OrgRole = Database["public"]["Enums"]["org_role"];

export type Membership = {
  orgId: string;
  name: string;
  slug: string;
  role: OrgRole;
};

export type AppContext = {
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  activeOrg: Membership;
  memberships: Membership[];
};

const ACTIVE_ORG_COOKIE = "active_org";

/** Roles allowed to create/edit catalog data. Mirrors the RLS write policies. */
export const CATALOG_EDITORS: OrgRole[] = ["super_admin", "inventory_manager"];

export function canEditCatalog(role: OrgRole): boolean {
  return CATALOG_EDITORS.includes(role);
}

/** Roles allowed to post stock movements. Mirrors the stock_movements RLS. */
export const STOCK_RECORDERS: OrgRole[] = [
  "super_admin",
  "inventory_manager",
  "warehouse_staff",
];

export function canRecordStock(role: OrgRole): boolean {
  return STOCK_RECORDERS.includes(role);
}

/**
 * The single source of truth for "who is signed in, and which organization are
 * they acting in". Every page under the app shell calls this.
 *
 * Redirects rather than returning null when preconditions fail, so callers can
 * treat the returned context as guaranteed-present:
 *   - not signed in            -> /login
 *   - signed in, but no org    -> /organizations/new
 *
 * The active org comes from a cookie set by the switcher, falling back to the
 * first membership. If the cookie points at an org they've left, it's ignored.
 */
export async function requireContext(): Promise<AppContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .single();

  // RLS returns only this user's memberships, so no user filter is needed.
  const { data: rows } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name, slug)")
    .order("created_at", { ascending: true });

  const memberships: Membership[] = (rows ?? [])
    .filter((r) => r.organizations)
    .map((r) => ({
      orgId: r.organizations!.id,
      name: r.organizations!.name,
      slug: r.organizations!.slug,
      role: r.role,
    }));

  if (memberships.length === 0) {
    redirect("/organizations/new");
  }

  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  const activeOrg =
    memberships.find((m) => m.orgId === preferred) ?? memberships[0];

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    activeOrg,
    memberships,
  };
}

export { ACTIVE_ORG_COOKIE };
