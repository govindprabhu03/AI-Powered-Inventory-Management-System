import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { WarehouseForm } from "@/components/warehouses/warehouse-form";
import { requireContext, canEditCatalog } from "@/lib/auth/context";
import { getOrgMembers } from "@/lib/data/members";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Edit warehouse · Smart Inventory" };

export default async function EditWarehousePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireContext();
  if (!canEditCatalog(ctx.activeOrg.role)) redirect("/warehouses");

  const supabase = await createClient();
  const [{ data: w }, members] = await Promise.all([
    supabase.from("warehouses").select("*").eq("id", id).single(),
    getOrgMembers(ctx.activeOrg.orgId),
  ]);
  if (!w) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-8 py-10">
      <div>
        <Link href="/warehouses" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Warehouses
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit warehouse</h1>
      </div>
      <WarehouseForm
        warehouseId={id}
        members={members}
        defaultValues={{
          name: w.name,
          address: w.address ?? "",
          capacity: w.capacity ?? "",
          managerId: w.manager_id ?? "",
        }}
      />
    </div>
  );
}
