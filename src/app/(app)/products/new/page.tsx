import Link from "next/link";
import { redirect } from "next/navigation";

import { ProductForm } from "@/components/products/product-form";
import { requireContext, canEditCatalog } from "@/lib/auth/context";
import { getCatalogOptions } from "@/lib/data/catalog-options";

export const metadata = { title: "Add product · Smart Inventory" };

export default async function NewProductPage() {
  const ctx = await requireContext();
  if (!canEditCatalog(ctx.activeOrg.role)) redirect("/products");

  const { categories, suppliers } = await getCatalogOptions(ctx.activeOrg.orgId);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-8 py-10">
      <div>
        <Link
          href="/products"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Products
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add product</h1>
      </div>

      <ProductForm categories={categories} suppliers={suppliers} />
    </div>
  );
}
