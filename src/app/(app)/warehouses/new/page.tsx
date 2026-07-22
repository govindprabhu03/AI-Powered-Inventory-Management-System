import Link from "next/link";
import { redirect } from "next/navigation";

import { WarehouseForm } from "@/components/warehouses/warehouse-form";
import { requireContext, canEditCatalog } from "@/lib/auth/context";
import { getOrgMembers } from "@/lib/data/members";

export const metadata = { title: "Add warehouse · Smart Inventory" };

export default async function NewWarehousePage() {
  const ctx = await requireContext();
  if (!canEditCatalog(ctx.activeOrg.role)) redirect("/warehouses");

  const members = await getOrgMembers(ctx.activeOrg.orgId);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-8 py-10">
      <div>
        <Link href="/warehouses" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Warehouses
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add warehouse</h1>
      </div>
      <WarehouseForm members={members} />
    </div>
  );
}
