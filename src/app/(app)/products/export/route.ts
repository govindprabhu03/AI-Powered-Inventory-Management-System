import Papa from "papaparse";

import { requireContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

// Column order for both export and import — one definition keeps them in sync.
export const CSV_COLUMNS = [
  "name",
  "sku",
  "barcode",
  "category",
  "supplier",
  "brand",
  "cost_price",
  "selling_price",
  "tax_rate",
  "unit",
  "weight",
  "reorder_level",
  "description",
] as const;

/**
 * GET /products/export -> a CSV download.
 *
 * This is a Route Handler, not a page: it returns a raw Response whose
 * Content-Disposition header tells the browser to save it as a file rather than
 * render it. requireContext() guards it (signed in + org); RLS scopes the rows.
 */
export async function GET() {
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select(
      "name, sku, barcode, brand, cost_price, selling_price, tax_rate, unit, weight, reorder_level, description, categories(name), suppliers(company_name)",
    )
    .eq("org_id", ctx.activeOrg.orgId)
    .order("name");

  const rows = (products ?? []).map((p) => ({
    name: p.name,
    sku: p.sku,
    barcode: p.barcode ?? "",
    category: p.categories?.name ?? "",
    supplier: p.suppliers?.company_name ?? "",
    brand: p.brand ?? "",
    cost_price: p.cost_price,
    selling_price: p.selling_price,
    tax_rate: p.tax_rate,
    unit: p.unit,
    weight: p.weight ?? "",
    reorder_level: p.reorder_level,
    description: p.description ?? "",
  }));

  const csv = Papa.unparse(rows, { columns: CSV_COLUMNS as unknown as string[] });
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="products-${date}.csv"`,
    },
  });
}
