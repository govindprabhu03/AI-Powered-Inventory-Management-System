"use server";

import { revalidatePath } from "next/cache";

import { requireContext, canEditCatalog } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "product-images";

async function authorize() {
  const ctx = await requireContext();
  return { ctx, allowed: canEditCatalog(ctx.activeOrg.role) };
}

/**
 * Record an already-uploaded file against a product.
 *
 * The browser uploads the bytes directly to Storage (RLS-checked there), then
 * calls this to save the row. We re-verify: the caller is a manager, the path
 * lives under their org, and the product belongs to their org.
 */
export async function recordProductImage(productId: string, storagePath: string) {
  const { ctx, allowed } = await authorize();
  if (!allowed) return { ok: false, error: "Not allowed" };

  // Path must start with this org's id — defence in depth against a forged path.
  if (!storagePath.startsWith(`${ctx.activeOrg.orgId}/`)) {
    return { ok: false, error: "Invalid file path" };
  }

  const supabase = await createClient();

  // Confirm the product is in this org (RLS returns nothing otherwise).
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .single();
  if (!product) return { ok: false, error: "Product not found" };

  // First image for a product becomes its primary automatically.
  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  const { error } = await supabase.from("product_images").insert({
    org_id: ctx.activeOrg.orgId,
    product_id: productId,
    storage_path: storagePath,
    is_primary: (count ?? 0) === 0,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/products/${productId}/edit`);
  revalidatePath("/products");
  return { ok: true };
}

export async function deleteProductImage(imageId: string) {
  const { allowed } = await authorize();
  if (!allowed) return { ok: false, error: "Not allowed" };

  const supabase = await createClient();

  const { data: image } = await supabase
    .from("product_images")
    .select("id, product_id, storage_path, is_primary")
    .eq("id", imageId)
    .single();
  if (!image) return { ok: false, error: "Image not found" };

  // Remove the bytes, then the row. If the storage delete fails we stop, so we
  // never leave a row pointing at a file that's gone.
  const { error: rmErr } = await supabase.storage
    .from(BUCKET)
    .remove([image.storage_path]);
  if (rmErr) return { ok: false, error: rmErr.message };

  await supabase.from("product_images").delete().eq("id", imageId);

  // If we removed the primary, promote the next remaining image.
  if (image.is_primary) {
    const { data: next } = await supabase
      .from("product_images")
      .select("id")
      .eq("product_id", image.product_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) {
      await supabase
        .from("product_images")
        .update({ is_primary: true })
        .eq("id", next.id);
    }
  }

  revalidatePath(`/products/${image.product_id}/edit`);
  revalidatePath("/products");
  return { ok: true };
}

export async function setPrimaryImage(imageId: string) {
  const { allowed } = await authorize();
  if (!allowed) return { ok: false, error: "Not allowed" };

  const supabase = await createClient();
  const { data: image } = await supabase
    .from("product_images")
    .select("id, product_id")
    .eq("id", imageId)
    .single();
  if (!image) return { ok: false, error: "Image not found" };

  // Only one primary per product (enforced by a partial unique index), so the
  // current primary must be cleared before setting the new one.
  await supabase
    .from("product_images")
    .update({ is_primary: false })
    .eq("product_id", image.product_id)
    .eq("is_primary", true);

  await supabase
    .from("product_images")
    .update({ is_primary: true })
    .eq("id", imageId);

  revalidatePath(`/products/${image.product_id}/edit`);
  revalidatePath("/products");
  return { ok: true };
}
