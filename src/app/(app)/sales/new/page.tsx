import Link from "next/link";
import { redirect } from "next/navigation";

import { SalesOrderForm } from "@/components/sales/sales-order-form";
import { Button } from "@/components/ui/button";
import { requireContext, canManageSales } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "New sales order · Smart Inventory" };

export default async function NewSalesOrderPage() {
  const ctx = await requireContext();
  if (!canManageSales(ctx.activeOrg.role)) redirect("/sales");

  const supabase = await createClient();
  const [{ data: customers }, { data: warehouses }, { data: products }] =
    await Promise.all([
      supabase.from("customers").select("id, name").eq("org_id", ctx.activeOrg.orgId).order("name"),
      supabase.from("warehouses").select("id, name").eq("org_id", ctx.activeOrg.orgId).order("name"),
      supabase.from("products").select("id, name, sku, selling_price").eq("org_id", ctx.activeOrg.orgId).eq("is_archived", false).order("name"),
    ]);

  const missing =
    (customers ?? []).length === 0 ||
    (warehouses ?? []).length === 0 ||
    (products ?? []).length === 0;

  if (missing) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-8 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">New sales order</h1>
        <p className="text-sm text-muted-foreground">
          A sales order needs at least one customer, one warehouse and one
          product. Add whichever is missing first.
        </p>
        <div className="flex gap-2">
          {(customers ?? []).length === 0 && (
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/customers/new">Add customer</Link>} />
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
        <Link href="/sales" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Sales orders
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New sales order</h1>
      </div>

      <SalesOrderForm
        customers={(customers ?? []).map((c) => ({ id: c.id, label: c.name }))}
        warehouses={(warehouses ?? []).map((w) => ({ id: w.id, label: w.name }))}
        products={(products ?? []).map((p) => ({
          id: p.id,
          label: `${p.name} (${p.sku})`,
          price: p.selling_price,
        }))}
      />
    </div>
  );
}
