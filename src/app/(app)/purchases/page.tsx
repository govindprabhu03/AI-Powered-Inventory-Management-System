import Link from "next/link";

import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/order-status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireContext, canManagePurchasing } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Purchase orders · Smart Inventory" };

export default async function PurchasesPage() {
  const ctx = await requireContext();
  const canCreate = canManagePurchasing(ctx.activeOrg.role);

  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("purchase_orders")
    .select("id, order_number, status, payment_status, created_at, suppliers(company_name)")
    .eq("org_id", ctx.activeOrg.orgId)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-8 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Purchase orders</h1>
          <p className="text-sm text-muted-foreground">Buying stock from suppliers.</p>
        </div>
        {canCreate && (
          <Button nativeButton={false} render={<Link href="/purchases/new">New purchase order</Link>} />
        )}
      </div>

      {orders && orders.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">
                    <Link href={`/purchases/${o.id}`} className="underline-offset-4 hover:underline">
                      {o.order_number}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{o.suppliers?.company_name}</TableCell>
                  <TableCell><OrderStatusBadge status={o.status} /></TableCell>
                  <TableCell><PaymentStatusBadge status={o.payment_status} /></TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
          {canCreate && (
            <div>
              <Button nativeButton={false} render={<Link href="/purchases/new">Create your first purchase order</Link>} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
