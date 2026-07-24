import Link from "next/link";

import { ReportShell, type ReportColumn } from "@/components/reports/report-shell";
import { Badge } from "@/components/ui/badge";
import { requireContext } from "@/lib/auth/context";
import { getLowStock } from "@/lib/data/reports";

export const metadata = { title: "Low stock · Smart Inventory" };

type Row = Awaited<ReturnType<typeof getLowStock>>[number];

export default async function LowStockReport() {
  const ctx = await requireContext();
  const rows = await getLowStock(ctx.activeOrg.orgId);

  const columns: ReportColumn<Row>[] = [
    { key: "name", label: "Product", render: (r) => (
      <span className="flex items-center gap-2">
        {r.name}
        <span className="font-mono text-xs text-muted-foreground">{r.sku}</span>
        {Number(r.available) <= 0 && <Badge variant="destructive">Out</Badge>}
      </span>
    ) },
    { key: "available", label: "Available", align: "right" },
    { key: "reorder_level", label: "Reorder level", align: "right" },
    { key: "action", label: "", render: (r) => (
      <Link href={`/purchases/new`} className="text-sm text-primary underline-offset-4 hover:underline">
        Reorder
      </Link>
    ) },
  ];

  return (
    <ReportShell
      title="Low stock"
      description="Products at or below their reorder level, across all warehouses."
      filename="low-stock"
      columns={columns}
      rows={rows}
      emptyMessage="Nothing is low on stock. 🎉"
    />
  );
}
