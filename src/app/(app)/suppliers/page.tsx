import Link from "next/link";

import { deleteSupplier } from "@/app/(app)/suppliers/actions";
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
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Suppliers · Smart Inventory" };

export default async function SuppliersPage() {
  const ctx = await requireContext();
  const canEdit = canEditCatalog(ctx.activeOrg.role);

  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, company_name, contact_person, email, phone")
    .order("company_name");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-8 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">
            {suppliers?.length ?? 0}{" "}
            {(suppliers?.length ?? 0) === 1 ? "supplier" : "suppliers"}
          </p>
        </div>
        {canEdit && (
          <Button
            nativeButton={false}
            render={<Link href="/suppliers/new">Add supplier</Link>}
          />
        )}
      </div>

      {suppliers && suppliers.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.company_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.contact_person ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.phone ?? "—"}
                  </TableCell>
                  <TableCell>
                    {canEdit && (
                      <EntityRowActions
                        id={s.id}
                        editHref={`/suppliers/${s.id}/edit`}
                        deleteAction={deleteSupplier}
                        confirmText="Delete this supplier? Products keep existing with no supplier."
                        label="Supplier actions"
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
          <p className="text-sm text-muted-foreground">No suppliers yet.</p>
          {canEdit && (
            <div>
              <Button
                nativeButton={false}
                render={<Link href="/suppliers/new">Add your first supplier</Link>}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
