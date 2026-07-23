import Link from "next/link";
import { redirect } from "next/navigation";

import { RecordMovementForm } from "@/components/stock/record-movement-form";
import { Button } from "@/components/ui/button";
import { requireContext, canRecordStock } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Record movement · Smart Inventory" };

export default async function RecordMovementPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const ctx = await requireContext();
  if (!canRecordStock(ctx.activeOrg.role)) redirect("/stock");
  const { product: initialProductId } = await searchParams;

  const supabase = await createClient();
  const [{ data: products }, { data: warehouses }] = await Promise.all([
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
  ]);

  if ((warehouses ?? []).length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-8 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Record movement</h1>
        <p className="text-sm text-muted-foreground">
          Stock lives in a warehouse, so you need at least one before recording
          movements.
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
          Record movement
        </h1>
      </div>

      <RecordMovementForm
        initialProductId={initialProductId}
        products={(products ?? []).map((p) => ({
          id: p.id,
          label: `${p.name} (${p.sku})`,
        }))}
        warehouses={(warehouses ?? []).map((w) => ({
          id: w.id,
          label: w.name,
        }))}
      />
    </div>
  );
}
