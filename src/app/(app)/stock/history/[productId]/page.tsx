import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Stock history · Smart Inventory" };

const TYPE_LABEL: Record<string, string> = {
  stock_in: "Stock in",
  stock_out: "Stock out",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  return: "Return",
  damage: "Damage",
  loss: "Loss",
  adjustment: "Adjustment",
};

export default async function StockHistoryPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const ctx = await requireContext();
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, name, sku, unit")
    .eq("id", productId)
    .eq("org_id", ctx.activeOrg.orgId)
    .single();

  if (!product) notFound();

  // The ledger itself: append-only, newest first. What you see here is exactly
  // what happened — rows are never edited or deleted.
  const { data: movements } = await supabase
    .from("stock_movements")
    .select("id, movement_type, quantity, note, reference, created_at, warehouses(name)")
    .eq("product_id", productId)
    .eq("org_id", ctx.activeOrg.orgId)
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: levels } = await supabase
    .from("stock_levels")
    .select("on_hand, available, warehouses(name)")
    .eq("product_id", productId)
    .eq("org_id", ctx.activeOrg.orgId);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-8 py-10">
      <div>
        <Link
          href="/stock"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Stock
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {product.name}
        </h1>
        <p className="font-mono text-sm text-muted-foreground">{product.sku}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(levels ?? []).map((l, i) => (
          <div key={i} className="rounded-lg border px-3 py-2 text-sm">
            <span className="text-muted-foreground">{l.warehouses?.name}: </span>
            <span className="font-medium tabular-nums">{l.on_hand}</span>
            <span className="text-muted-foreground"> on hand</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(movements ?? []).map((m) => (
              <TableRow key={m.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {new Date(m.created_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {TYPE_LABEL[m.movement_type] ?? m.movement_type}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {m.warehouses?.name}
                </TableCell>
                <TableCell
                  className={`text-right font-medium tabular-nums ${
                    m.quantity > 0
                      ? "text-green-600 dark:text-green-500"
                      : "text-destructive"
                  }`}
                >
                  {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {m.reference ?? ""}
                </TableCell>
                <TableCell className="max-w-48 truncate text-muted-foreground">
                  {m.note ?? ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        This history is append-only. Mistakes are corrected by posting an
        adjustment, never by editing the past — the same discipline as an
        accounting ledger.
      </p>
    </div>
  );
}
