import { ReportShell, type ReportColumn } from "@/components/reports/report-shell";
import { requireContext } from "@/lib/auth/context";
import { getDeadStock } from "@/lib/data/reports";

export const metadata = { title: "Dead stock · Smart Inventory" };

const money = (n: unknown) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(Number(n));

type Row = Awaited<ReturnType<typeof getDeadStock>>[number];

export default async function DeadStockReport() {
  const ctx = await requireContext();
  const rows = await getDeadStock(ctx.activeOrg.orgId);
  const tiedUp = rows.reduce((s, r) => s + Number(r.cost_value), 0);

  const columns: ReportColumn<Row>[] = [
    { key: "name", label: "Product", render: (r) => (
      <span>{r.name} <span className="font-mono text-xs text-muted-foreground">{r.sku}</span></span>
    ) },
    { key: "on_hand", label: "On hand", align: "right" },
    { key: "cost_value", label: "Capital tied up", align: "right", render: (r) => money(r.cost_value) },
    { key: "last_sold_at", label: "Last sold", render: (r) =>
      r.last_sold_at ? new Date(r.last_sold_at).toLocaleDateString() : "Never" },
  ];

  return (
    <ReportShell
      title="Dead stock"
      description={`Stock on hand with no sale in 90 days. Capital tied up: ${money(tiedUp)}`}
      filename="dead-stock"
      columns={columns}
      rows={rows}
      emptyMessage="No dead stock — everything is moving."
    />
  );
}
