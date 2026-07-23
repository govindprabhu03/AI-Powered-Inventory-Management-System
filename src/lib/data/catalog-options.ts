import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Fetch categories and suppliers as {id, label} options for the product form's
 * dropdowns, scoped to the ACTIVE org. (RLS alone would return every org the
 * user belongs to, which is a security boundary, not a UX filter.)
 */
export async function getCatalogOptions(orgId: string) {
  const supabase = await createClient();

  const [{ data: categories }, { data: suppliers }] = await Promise.all([
    supabase.from("categories").select("id, name").eq("org_id", orgId).order("name"),
    supabase
      .from("suppliers")
      .select("id, company_name")
      .eq("org_id", orgId)
      .order("company_name"),
  ]);

  return {
    categories: (categories ?? []).map((c) => ({ id: c.id, label: c.name })),
    suppliers: (suppliers ?? []).map((s) => ({
      id: s.id,
      label: s.company_name,
    })),
  };
}
