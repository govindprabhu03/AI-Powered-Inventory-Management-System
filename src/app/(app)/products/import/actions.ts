"use server";

import Papa from "papaparse";

import { requireContext, canEditCatalog } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { productSchema } from "@/lib/validation/product";
import type { Database } from "@/lib/database.types";

type ProductRow = Database["public"]["Tables"]["products"]["Insert"];

export type ImportResult = {
  ok: boolean;
  total: number;
  inserted: number;
  errors: { row: number; message: string }[];
  error?: string;
};

/**
 * Import products from CSV text.
 *
 * Every row is validated against the SAME productSchema the form uses, so the
 * rules can't diverge. Good rows import; bad rows are reported by line number
 * with the reason — the file is never rejected wholesale for one bad row.
 */
export async function importProducts(csvText: string): Promise<ImportResult> {
  const { ctx, allowed } = await (async () => {
    const c = await requireContext();
    return { ctx: c, allowed: canEditCatalog(c.activeOrg.role) };
  })();

  if (!allowed) {
    return { ok: false, total: 0, inserted: 0, errors: [], error: "Not allowed" };
  }

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const raw = parsed.data;
  if (raw.length === 0) {
    return { ok: false, total: 0, inserted: 0, errors: [], error: "The file has no data rows." };
  }

  const supabase = await createClient();

  // Resolve category/supplier names to ids once. Unknown names are left null,
  // which is a warning-level condition, not a hard error.
  const [{ data: cats }, { data: sups }] = await Promise.all([
    supabase.from("categories").select("id, name"),
    supabase.from("suppliers").select("id, company_name"),
  ]);
  const catByName = new Map((cats ?? []).map((c) => [c.name.toLowerCase(), c.id]));
  const supByName = new Map(
    (sups ?? []).map((s) => [s.company_name.toLowerCase(), s.id]),
  );

  const errors: ImportResult["errors"] = [];
  const valid: { row: number; data: ProductRow }[] = [];

  raw.forEach((r, i) => {
    const rowNum = i + 2; // +1 for the header line, +1 for 1-based counting

    const mapped = {
      name: r.name,
      sku: r.sku,
      barcode: r.barcode,
      description: r.description,
      categoryId: r.category ? catByName.get(r.category.trim().toLowerCase()) ?? "" : "",
      supplierId: r.supplier ? supByName.get(r.supplier.trim().toLowerCase()) ?? "" : "",
      brand: r.brand,
      costPrice: r.cost_price,
      sellingPrice: r.selling_price,
      taxRate: r.tax_rate,
      unit: r.unit || "pcs",
      weight: r.weight,
      reorderLevel: r.reorder_level || 0,
    };

    const result = productSchema.safeParse(mapped);
    if (!result.success) {
      const fe = result.error.flatten().fieldErrors;
      const first =
        Object.entries(fe)
          .map(([f, msgs]) => `${f}: ${msgs?.[0]}`)
          .join("; ") || "Invalid row";
      errors.push({ row: rowNum, message: first });
      return;
    }

    const v = result.data;
    valid.push({
      row: rowNum,
      data: {
        org_id: ctx.activeOrg.orgId,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode ?? null,
        description: v.description ?? null,
        category_id: v.categoryId ?? null,
        supplier_id: v.supplierId ?? null,
        brand: v.brand ?? null,
        cost_price: v.costPrice,
        selling_price: v.sellingPrice,
        tax_rate: v.taxRate,
        unit: v.unit,
        weight: v.weight ?? null,
        reorder_level: v.reorderLevel,
      },
    });
  });

  // Insert row-by-row so a single duplicate SKU is reported against its line
  // instead of aborting the whole batch. Fine for the hundreds-of-rows scale
  // this importer targets.
  let inserted = 0;
  for (const { row, data } of valid) {
    const { error } = await supabase.from("products").insert(data);
    if (error) {
      errors.push({
        row,
        message: error.code === "23505" ? "Duplicate SKU" : error.message,
      });
    } else {
      inserted++;
    }
  }

  return { ok: true, total: raw.length, inserted, errors };
}
