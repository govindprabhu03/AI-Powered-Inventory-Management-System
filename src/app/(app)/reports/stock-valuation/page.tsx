import { ReportShell, type ReportColumn } from "@/components/reports/report-shell";
import { requireContext } from "@/lib/auth/context";
import { getStockValuation } from "@/lib/data/reports";

export const metadata = { title: "Stock valuation · Smart Inventory" };

const money = (n: unknown) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(Number(n));

type Row = Awaited<ReturnType<typeof getStockValuation>>[number];

export default async function StockValuationReport() {
  const ctx = await requireContext();
  const rows = await getStockValuation(ctx.activeOrg.orgId);
  const totalCost = rows.reduce((s, r) => s + Number(r.cost_value), 0);

  const columns: ReportColumn<Row>[] = [
    { key: "name", label: "Product", render: (r) => (
      <span>{r.name} <span className="font-mono text-xs text-muted-foreground">{r.sku}</span></span>
    ) },
    { key: "on_hand", label: "On hand", align: "right" },
    { key: "cost_price", label: "Cost", align: "right", render: (r) => money(r.cost_price) },
    { key: "cost_value", label: "Cost value", align: "right", render: (r) => money(r.cost_value) },
    { key: "retail_value", label: "Retail value", align: "right", render: (r) => money(r.retail_value) },
  ];

  return (
    <ReportShell
      title="Stock valuation"
      description={`Total inventory value at cost: ${money(totalCost)}`}
      filename="stock-valuation"
      columns={columns}
      rows={rows}
      emptyMessage="No stock to value yet."
    />
  );
}
