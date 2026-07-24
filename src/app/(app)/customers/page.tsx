import Link from "next/link";

import { deleteCustomer } from "@/app/(app)/customers/actions";
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
import { requireContext, canManageSales } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Customers · Smart Inventory" };

export default async function CustomersPage() {
  const ctx = await requireContext();
  const canEdit = canManageSales(ctx.activeOrg.role);

  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, email, phone")
    .eq("org_id", ctx.activeOrg.orgId)
    .order("name");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-8 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            {customers?.length ?? 0}{" "}
            {(customers?.length ?? 0) === 1 ? "customer" : "customers"}
          </p>
        </div>
        {canEdit && (
          <Button
            nativeButton={false}
            render={<Link href="/customers/new">Add customer</Link>}
          />
        )}
      </div>

      {customers && customers.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                  <TableCell>
                    {canEdit && (
                      <EntityRowActions
                        id={c.id}
                        editHref={`/customers/${c.id}/edit`}
                        deleteAction={deleteCustomer}
                        confirmText="Delete this customer?"
                        label="Customer actions"
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
          <p className="text-sm text-muted-foreground">No customers yet.</p>
          {canEdit && (
            <div>
              <Button
                nativeButton={false}
                render={<Link href="/customers/new">Add your first customer</Link>}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
