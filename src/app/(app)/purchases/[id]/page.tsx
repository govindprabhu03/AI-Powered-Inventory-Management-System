import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/order-status-badge";
import { PoActions } from "@/components/purchases/po-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  requireContext,
  canManagePurchasing,
  canApprovePurchase,
  canFulfil,
} from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Purchase order · Smart Inventory" };

const money = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);

export default async function PurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireContext();
  const role = ctx.activeOrg.role;

  const supabase = await createClient();
  const { data: po } = await supabase
    .from("purchase_orders")
    .select("*, suppliers(company_name), warehouses(name)")
    .eq("id", id)
    .eq("org_id", ctx.activeOrg.orgId)
    .single();

  if (!po) notFound();

  const { data: items } = await supabase
    .from("purchase_order_items")
    .select("id, quantity, unit_cost, products(name, sku)")
    .eq("purchase_order_id", id);

  const total = (items ?? []).reduce((s, i) => s + i.quantity * i.unit_cost, 0);

  // Legal actions = current status × caller's role. The DB re-checks all of
  // this; here we only decide what to show.
  const manage = canManagePurchasing(role);
  const actions = {
    canSubmit: manage && po.status === "draft",
    canApprove: canApprovePurchase(role) && po.status === "pending_approval",
    canReceive: canFulfil(role) && po.status === "approved",
    canCancel: manage && ["draft", "pending_approval", "approved"].includes(po.status),
    canPay: manage && po.status !== "cancelled",
  };
  const showActions = Object.values(actions).some(Boolean);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-8 py-10">
      <div>
        <Link href="/purchases" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Purchase orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{po.order_number}</h1>
          <OrderStatusBadge status={po.status} />
          <PaymentStatusBadge status={po.payment_status} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm sm:grid-cols-4">
        <Meta label="Supplier" value={po.suppliers?.company_name ?? "—"} />
        <Meta label="Warehouse" value={po.warehouses?.name ?? "—"} />
        <Meta label="Expected" value={po.expected_date ? new Date(po.expected_date).toLocaleDateString() : "—"} />
        <Meta label="Created" value={new Date(po.created_at).toLocaleDateString()} />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit cost</TableHead>
              <TableHead className="text-right">Line total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items ?? []).map((i) => (
              <TableRow key={i.id}>
                <TableCell>
                  {i.products?.name}{" "}
                  <span className="font-mono text-xs text-muted-foreground">{i.products?.sku}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{i.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">{money(i.unit_cost)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(i.quantity * i.unit_cost)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={3} className="text-right font-medium">Total</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{money(total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {po.notes && (
        <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">{po.notes}</p>
      )}

      {showActions && (
        <div className="rounded-lg border p-4">
          <PoActions id={id} {...actions} />
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
