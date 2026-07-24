import Link from "next/link";

import { RealtimeStockRefresher } from "@/components/stock/realtime-refresher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireContext, canRecordStock } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Stock · Smart Inventory" };

export default async function StockPage() {
  const ctx = await requireContext();
  const canRecord = canRecordStock(ctx.activeOrg.role);

  const supabase = await createClient();
  const [{ data: levels }, { data: incomingRows }] = await Promise.all([
    supabase
      .from("stock_levels")
      .select(
        "id, warehouse_id, on_hand, reserved, available, products(id, name, sku, unit, reorder_level), warehouses(name)",
      )
      .eq("org_id", ctx.activeOrg.orgId)
      .order("updated_at", { ascending: false }),
    // Incoming = quantities on approved-but-not-yet-received purchase orders,
    // keyed to the destination warehouse.
    supabase
      .from("purchase_order_items")
      .select("product_id, quantity, purchase_orders!inner(warehouse_id, status)")
      .eq("org_id", ctx.activeOrg.orgId)
      .eq("purchase_orders.status", "approved"),
  ]);

  // Build an incoming map keyed product:warehouse.
  const incoming = new Map<string, number>();
  for (const r of incomingRows ?? []) {
    const wh = r.purchase_orders?.warehouse_id;
    if (!wh) continue;
    const key = `${r.product_id}:${wh}`;
    incoming.set(key, (incoming.get(key) ?? 0) + r.quantity);
  }

  const rows = (levels ?? []).filter((l) => l.products && l.warehouses);
  rows.sort((a, b) =>
    (a.products!.name + a.warehouses!.name).localeCompare(
      b.products!.name + b.warehouses!.name,
    ),
  );

  // "Low stock" compares a product's TOTAL available across warehouses with
  // its reorder level.
  const totals = new Map<string, number>();
  for (const l of rows) {
    totals.set(
      l.products!.id,
      // `available` is a generated column, typed nullable; it is never null in
      // practice (generated from two NOT NULL columns).
      (totals.get(l.products!.id) ?? 0) + (l.available ?? l.on_hand - l.reserved),
    );
  }
  const isLow = (productId: string, reorderLevel: number) =>
    reorderLevel > 0 && (totals.get(productId) ?? 0) <= reorderLevel;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-8 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock</h1>
          <p className="text-sm text-muted-foreground">
            On-hand quantities per product and warehouse, derived from the
            movement ledger.
          </p>
        </div>
        {canRecord && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/stock/scan">Scan</Link>}
            />
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/stock/transfer">Transfer</Link>}
            />
            <Button
              nativeButton={false}
              render={<Link href="/stock/record">Record movement</Link>}
            />
          </div>
        )}
      </div>

      {/* Live updates: any stock_levels change in this org re-renders the page. */}
      <RealtimeStockRefresher orgId={ctx.activeOrg.orgId} />

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Incoming</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Link
                        href={`/stock/history/${l.products!.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {l.products!.name}
                      </Link>
                      <span className="font-mono text-xs text-muted-foreground">
                        {l.products!.sku}
                      </span>
                      {isLow(l.products!.id, l.products!.reorder_level) && (
                        <Badge variant="destructive">Low</Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.warehouses!.name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.on_hand}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {l.reserved}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {l.available}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {incoming.get(`${l.products!.id}:${l.warehouse_id}`) ?? 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No stock recorded yet. Every quantity here comes from a movement —
            record your first stock-in to begin.
          </p>
          {canRecord && (
            <div>
              <Button
                nativeButton={false}
                render={<Link href="/stock/record">Record first stock-in</Link>}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
