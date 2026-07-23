import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ProductForm } from "@/components/products/product-form";
import { ProductImages } from "@/components/products/product-images";
import { requireContext, canEditCatalog } from "@/lib/auth/context";
import { getCatalogOptions } from "@/lib/data/catalog-options";
import { getProductImages } from "@/lib/data/product-images";
import { createClient } from "@/lib/supabase/server";
import type { ProductFormValues } from "@/lib/validation/product";

export const metadata = { title: "Edit product · Smart Inventory" };

// params is a Promise in Next.js 16.
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ctx = await requireContext();
  if (!canEditCatalog(ctx.activeOrg.role)) redirect("/products");

  const supabase = await createClient();

  // RLS guarantees this only returns a product in the active org's tenant.
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (!product) notFound();

  const { categories, suppliers } = await getCatalogOptions(ctx.activeOrg.orgId);
  const images = await getProductImages(id);

  // Map the database row onto the form's field names. Numbers become strings
  // for the inputs; nulls become empty strings.
  const defaults: Partial<ProductFormValues> = {
    name: product.name,
    sku: product.sku,
    barcode: product.barcode ?? "",
    description: product.description ?? "",
    categoryId: product.category_id ?? "",
    supplierId: product.supplier_id ?? "",
    brand: product.brand ?? "",
    costPrice: product.cost_price,
    sellingPrice: product.selling_price,
    taxRate: product.tax_rate,
    unit: product.unit,
    weight: product.weight ?? "",
    reorderLevel: product.reorder_level,
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-8 py-10">
      <div>
        <Link
          href="/products"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Products
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Edit product
        </h1>
      </div>

      <ProductForm
        productId={id}
        defaultValues={defaults}
        categories={categories}
        suppliers={suppliers}
      />

      <section className="grid gap-3 border-t pt-6">
        <h2 className="text-sm font-medium">Images</h2>
        <ProductImages
          productId={id}
          orgId={ctx.activeOrg.orgId}
          images={images}
        />
      </section>
    </div>
  );
}
