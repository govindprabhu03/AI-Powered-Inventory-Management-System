import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Fetch categories and suppliers as {id, label} options for the product form's
 * dropdowns. RLS scopes both to the active org automatically.
 */
export async function getCatalogOptions() {
  const supabase = await createClient();

  const [{ data: categories }, { data: suppliers }] = await Promise.all([
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("suppliers").select("id, company_name").order("company_name"),
  ]);

  return {
    categories: (categories ?? []).map((c) => ({ id: c.id, label: c.name })),
    suppliers: (suppliers ?? []).map((s) => ({
      id: s.id,
      label: s.company_name,
    })),
  };
}
