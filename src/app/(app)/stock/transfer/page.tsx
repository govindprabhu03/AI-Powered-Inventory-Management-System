import Link from "next/link";
import { redirect } from "next/navigation";

import { TransferForm } from "@/components/stock/transfer-form";
import { Button } from "@/components/ui/button";
import { requireContext, canRecordStock } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Transfer stock · Smart Inventory" };

export default async function TransferPage() {
  const ctx = await requireContext();
  if (!canRecordStock(ctx.activeOrg.role)) redirect("/stock");

  const supabase = await createClient();
  const [{ data: products }, { data: warehouses }, { data: levels }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, sku")
        .eq("org_id", ctx.activeOrg.orgId)
        .eq("is_archived", false)
        .order("name"),
      supabase
        .from("warehouses")
        .select("id, name")
        .eq("org_id", ctx.activeOrg.orgId)
        .order("name"),
      supabase
        .from("stock_levels")
        .select("product_id, warehouse_id, on_hand")
        .eq("org_id", ctx.activeOrg.orgId),
    ]);

  if ((warehouses ?? []).length < 2) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-8 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Transfer stock</h1>
        <p className="text-sm text-muted-foreground">
          Transfers move stock between two warehouses, so you need at least two.
        </p>
        <div>
          <Button
            nativeButton={false}
            render={<Link href="/warehouses/new">Create a warehouse</Link>}
          />
        </div>
      </div>
    );
  }

  // Availability hints for the form, keyed product:warehouse.
  const levelMap: Record<string, number> = {};
  for (const l of levels ?? []) {
    levelMap[`${l.product_id}:${l.warehouse_id}`] = l.on_hand;
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-8 py-10">
      <div>
        <Link
          href="/stock"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Stock
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Transfer stock
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Both sides of the transfer happen together or not at all.
        </p>
      </div>

      <TransferForm
        products={(products ?? []).map((p) => ({
          id: p.id,
          label: `${p.name} (${p.sku})`,
        }))}
        warehouses={(warehouses ?? []).map((w) => ({ id: w.id, label: w.name }))}
        levels={levelMap}
      />
    </div>
  );
}
