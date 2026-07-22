import "server-only";

import { createClient } from "@/lib/supabase/server";

const BUCKET = "product-images";
const SIGNED_URL_TTL = 60 * 60; // 1 hour

export type ProductImage = {
  id: string;
  isPrimary: boolean;
  url: string | null;
};

/** A product's images with fresh signed URLs, primary first. */
export async function getProductImages(
  productId: string,
): Promise<ProductImage[]> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("product_images")
    .select("id, storage_path, is_primary")
    .eq("product_id", productId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (!rows || rows.length === 0) return [];

  // Sign every path in one call rather than one round trip per image.
  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      SIGNED_URL_TTL,
    );

  const urlByPath = new Map(
    (signed ?? []).map((s) => [s.path, s.signedUrl]),
  );

  return rows.map((r) => ({
    id: r.id,
    isPrimary: r.is_primary,
    url: urlByPath.get(r.storage_path) ?? null,
  }));
}

/** Primary-image signed URL for each of the given products (for list thumbnails). */
export async function getPrimaryImageUrls(
  productIds: string[],
): Promise<Map<string, string>> {
  if (productIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("product_images")
    .select("product_id, storage_path")
    .in("product_id", productIds)
    .eq("is_primary", true);

  if (!rows || rows.length === 0) return new Map();

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      SIGNED_URL_TTL,
    );

  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  const out = new Map<string, string>();
  for (const r of rows) {
    const url = urlByPath.get(r.storage_path);
    if (url) out.set(r.product_id, url);
  }
  return out;
}
