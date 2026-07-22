import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Org members as {id, label} for the warehouse "manager" picker.
 *
 * organization_members.user_id and profiles.id both reference auth.users, but
 * there's no direct FK between the two tables, so Supabase can't embed one in
 * the other. We fetch member ids, then their profiles, and join in memory.
 * Both queries are RLS-scoped: memberships to this org, profiles to colleagues.
 */
export async function getOrgMembers(orgId: string) {
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("org_id", orgId);

  const ids = (members ?? []).map((m) => m.user_id);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  return ids.map((id) => ({ id, label: nameById.get(id) || "Member" }));
}

/** Whether a user id belongs to the given org (used to validate manager). */
export async function isOrgMember(orgId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}
