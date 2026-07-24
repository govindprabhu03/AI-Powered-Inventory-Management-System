import Link from "next/link";
import { redirect } from "next/navigation";

import { PurchaseOrderForm } from "@/components/purchases/purchase-order-form";
import { Button } from "@/components/ui/button";
import { requireContext, canManagePurchasing } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "New purchase order · Smart Inventory" };

export default async function NewPurchaseOrderPage() {
  const ctx = await requireContext();
  if (!canManagePurchasing(ctx.activeOrg.role)) redirect("/purchases");

  const supabase = await createClient();
  const [{ data: suppliers }, { data: warehouses }, { data: products }] =
    await Promise.all([
      supabase.from("suppliers").select("id, company_name").eq("org_id", ctx.activeOrg.orgId).order("company_name"),
      supabase.from("warehouses").select("id, name").eq("org_id", ctx.activeOrg.orgId).order("name"),
      supabase.from("products").select("id, name, sku, cost_price").eq("org_id", ctx.activeOrg.orgId).eq("is_archived", false).order("name"),
    ]);

  const missing =
    (suppliers ?? []).length === 0 ||
    (warehouses ?? []).length === 0 ||
    (products ?? []).length === 0;

  if (missing) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-8 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">New purchase order</h1>
        <p className="text-sm text-muted-foreground">
          A purchase order needs at least one supplier, one warehouse and one
          product. Add whichever is missing first.
        </p>
        <div className="flex gap-2">
          {(suppliers ?? []).length === 0 && (
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/suppliers/new">Add supplier</Link>} />
          )}
          {(warehouses ?? []).length === 0 && (
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/warehouses/new">Add warehouse</Link>} />
          )}
          {(products ?? []).length === 0 && (
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/products/new">Add product</Link>} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-8 py-10">
      <div>
        <Link href="/purchases" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Purchase orders
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New purchase order</h1>
      </div>

      <PurchaseOrderForm
        suppliers={(suppliers ?? []).map((s) => ({ id: s.id, label: s.company_name }))}
        warehouses={(warehouses ?? []).map((w) => ({ id: w.id, label: w.name }))}
        products={(products ?? []).map((p) => ({
          id: p.id,
          label: `${p.name} (${p.sku})`,
          cost: p.cost_price,
        }))}
      />
    </div>
  );
}
