import Link from "next/link";

import { LabelSheet } from "@/components/products/label-sheet";
import { requireContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Product labels · Smart Inventory" };

export default async function LabelsPage() {
  await requireContext();
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku, barcode")
    .eq("is_archived", false)
    .order("name");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-8 py-10">
      <div data-no-print>
        <Link
          href="/products"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Products
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Barcode labels
        </h1>
      </div>

      {products && products.length > 0 ? (
        <LabelSheet products={products} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No products to print labels for.
        </p>
      )}
    </div>
  );
}
