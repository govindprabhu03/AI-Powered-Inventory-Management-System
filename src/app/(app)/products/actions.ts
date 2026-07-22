"use server";

import { revalidatePath } from "next/cache";

import { requireContext, canEditCatalog } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { productSchema } from "@/lib/validation/product";

export type ProductMutationResult =
  | { ok: true; id: string }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

/** Map validated form values onto database columns (camelCase -> snake_case). */
function toRow(values: ReturnType<typeof productSchema.parse>, orgId: string) {
  return {
    org_id: orgId,
    name: values.name,
    sku: values.sku,
    barcode: values.barcode ?? null,
    description: values.description ?? null,
    category_id: values.categoryId ?? null,
    supplier_id: values.supplierId ?? null,
    brand: values.brand ?? null,
    cost_price: values.costPrice,
    selling_price: values.sellingPrice,
    tax_rate: values.taxRate,
    unit: values.unit,
    weight: values.weight ?? null,
    reorder_level: values.reorderLevel,
  };
}

async function authorize() {
  const ctx = await requireContext();
  if (!canEditCatalog(ctx.activeOrg.role)) {
    return { ctx, allowed: false as const };
  }
  return { ctx, allowed: true as const };
}

export async function createProduct(
  values: unknown,
): Promise<ProductMutationResult> {
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { ctx, allowed } = await authorize();
  if (!allowed) {
    return { ok: false, error: "You do not have permission to add products." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert(toRow(parsed.data, ctx.activeOrg.orgId))
    .select("id")
    .single();

  if (error) {
    // 23505 = unique_violation, which here can only be the (org_id, sku) rule.
    if (error.code === "23505") {
      return { ok: false, fieldErrors: { sku: ["A product with this SKU already exists."] } };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/products");
  return { ok: true, id: data.id };
}

export async function updateProduct(
  id: string,
  values: unknown,
): Promise<ProductMutationResult> {
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { ctx, allowed } = await authorize();
  if (!allowed) {
    return { ok: false, error: "You do not have permission to edit products." };
  }

  const supabase = await createClient();
  const row = toRow(parsed.data, ctx.activeOrg.orgId);

  // The id + RLS together scope this to the caller's org; a product in another
  // org simply matches no row and updates nothing.
  const { data, error } = await supabase
    .from("products")
    .update(row)
    .eq("id", id)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, fieldErrors: { sku: ["A product with this SKU already exists."] } };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { ok: true, id: data.id };
}

/** Archive or restore. Archiving hides a product without losing its history. */
export async function setProductArchived(id: string, archived: boolean) {
  const { allowed } = await authorize();
  if (!allowed) return;

  const supabase = await createClient();
  await supabase.from("products").update({ is_archived: archived }).eq("id", id);
  revalidatePath("/products");
}

/**
 * Hard delete. Reserved for products created by mistake. Once Phase 3 adds stock
 * movements, a foreign key will block deleting anything with history, and the
 * UI will steer users to archive instead.
 */
export async function deleteProduct(id: string) {
  const { allowed } = await authorize();
  if (!allowed) return { ok: false, error: "Not allowed" };

  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/products");
  return { ok: true };
}
