import Link from "next/link";
import { redirect } from "next/navigation";

import { CsvImport } from "@/components/products/csv-import";
import { requireContext, canEditCatalog } from "@/lib/auth/context";

export const metadata = { title: "Import products · Smart Inventory" };

export default async function ImportProductsPage() {
  const ctx = await requireContext();
  if (!canEditCatalog(ctx.activeOrg.role)) redirect("/products");

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
          Import products
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a CSV. The columns match the export file — the quickest way to
          get a template is to export first.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 text-sm">
        <p className="font-medium">Expected columns</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          name, sku, barcode, category, supplier, brand, cost_price,
          selling_price, tax_rate, unit, weight, reorder_level, description
        </p>
        <p className="mt-2 text-muted-foreground">
          <span className="font-medium">name</span> and{" "}
          <span className="font-medium">sku</span> are required. Category and
          supplier are matched by name; unknown names are left blank.
        </p>
      </div>

      <CsvImport />
    </div>
  );
}
