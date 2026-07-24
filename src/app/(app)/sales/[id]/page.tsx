import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/order-status-badge";
import { SoActions } from "@/components/sales/so-actions";
import { ReturnsForm, type ReturnableLine } from "@/components/sales/returns-form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireContext, canManageSales, canFulfil } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Sales order · Smart Inventory" };

const money = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(n);

export default async function SalesOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireContext();
  const role = ctx.activeOrg.role;

  const supabase = await createClient();
  const { data: so } = await supabase
    .from("sales_orders")
    .select("*, customers(name), warehouses(name)")
    .eq("id", id)
    .eq("org_id", ctx.activeOrg.orgId)
    .single();

  if (!so) notFound();

  const { data: items } = await supabase
    .from("sales_order_items")
    .select("id, product_id, quantity, unit_price, products(name, sku)")
    .eq("sales_order_id", id);

  const total = (items ?? []).reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const manage = canManageSales(role);
  const fulfil = canFulfil(role);
  const actions = {
    canConfirm: manage && so.status === "draft",
    canFulfil: fulfil && so.status === "confirmed",
    canCancel: manage && ["draft", "confirmed"].includes(so.status),
    canPay: manage && so.status !== "cancelled",
  };
  const showActions = Object.values(actions).some(Boolean);

  // Returns are possible on a fulfilled order. Compute how much of each line has
  // already come back (sum of 'return' movements tagged with this order number).
  let returnLines: ReturnableLine[] = [];
  if (fulfil && so.status === "fulfilled") {
    const { data: returns } = await supabase
      .from("stock_movements")
      .select("product_id, quantity")
      .eq("org_id", ctx.activeOrg.orgId)
      .eq("movement_type", "return")
      .eq("reference", so.order_number);

    const returnedByProduct = new Map<string, number>();
    for (const r of returns ?? []) {
      returnedByProduct.set(
        r.product_id,
        (returnedByProduct.get(r.product_id) ?? 0) + r.quantity,
      );
    }

    returnLines = (items ?? []).map((i) => ({
      productId: i.product_id,
      label: `${i.products?.name} (${i.products?.sku})`,
      sold: i.quantity,
      alreadyReturned: returnedByProduct.get(i.product_id) ?? 0,
    }));
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-8 py-10">
      <div>
        <Link href="/sales" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Sales orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{so.order_number}</h1>
          <OrderStatusBadge status={so.status} />
          <PaymentStatusBadge status={so.payment_status} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm sm:grid-cols-4">
        <Meta label="Customer" value={so.customers?.name ?? "—"} />
        <Meta label="Warehouse" value={so.warehouses?.name ?? "—"} />
        <Meta label="Created" value={new Date(so.created_at).toLocaleDateString()} />
        <Meta label="Fulfilled" value={so.fulfilled_at ? new Date(so.fulfilled_at).toLocaleDateString() : "—"} />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
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
                <TableCell className="text-right tabular-nums">{money(i.unit_price)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(i.quantity * i.unit_price)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={3} className="text-right font-medium">Total</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{money(total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {so.notes && (
        <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">{so.notes}</p>
      )}

      {showActions && (
        <div className="rounded-lg border p-4">
          <SoActions id={id} {...actions} />
        </div>
      )}

      {fulfil && so.status === "fulfilled" && (
        <div className="grid gap-3 rounded-lg border p-4">
          <h2 className="text-sm font-medium">Returns</h2>
          <ReturnsForm id={id} lines={returnLines} />
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
