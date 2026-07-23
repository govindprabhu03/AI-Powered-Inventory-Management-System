import Link from "next/link";

import { deleteWarehouse } from "@/app/(app)/warehouses/actions";
import { EntityRowActions } from "@/components/app/entity-row-actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireContext, canEditCatalog } from "@/lib/auth/context";
import { getOrgMembers } from "@/lib/data/members";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Warehouses · Smart Inventory" };

export default async function WarehousesPage() {
  const ctx = await requireContext();
  const canEdit = canEditCatalog(ctx.activeOrg.role);

  const supabase = await createClient();
  const [{ data: warehouses }, members] = await Promise.all([
    supabase
      .from("warehouses")
      .select("id, name, address, capacity, manager_id")
      .eq("org_id", ctx.activeOrg.orgId) // scope to the ACTIVE org, not all orgs
      .order("name"),
    getOrgMembers(ctx.activeOrg.orgId),
  ]);

  const nameById = new Map(members.map((m) => [m.id, m.label]));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-8 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Warehouses</h1>
          <p className="text-sm text-muted-foreground">
            {warehouses?.length ?? 0}{" "}
            {(warehouses?.length ?? 0) === 1 ? "warehouse" : "warehouses"}
          </p>
        </div>
        {canEdit && (
          <Button
            nativeButton={false}
            render={<Link href="/warehouses/new">Add warehouse</Link>}
          />
        )}
      </div>

      {warehouses && warehouses.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead className="text-right">Capacity</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">{w.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {w.manager_id ? (nameById.get(w.manager_id) ?? "Member") : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {w.capacity ?? "—"}
                  </TableCell>
                  <TableCell>
                    {canEdit && (
                      <EntityRowActions
                        id={w.id}
                        editHref={`/warehouses/${w.id}/edit`}
                        deleteAction={deleteWarehouse}
                        confirmText="Delete this warehouse?"
                        label="Warehouse actions"
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">No warehouses yet.</p>
          {canEdit && (
            <div>
              <Button
                nativeButton={false}
                render={<Link href="/warehouses/new">Add your first warehouse</Link>}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
