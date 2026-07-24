import { ReportShell, type ReportColumn } from "@/components/reports/report-shell";
import { requireContext } from "@/lib/auth/context";
import { getBestSellers } from "@/lib/data/reports";

export const metadata = { title: "Best sellers · Smart Inventory" };

const money = (n: unknown) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(Number(n));

type Row = Awaited<ReturnType<typeof getBestSellers>>[number];

export default async function BestSellersReport() {
  const ctx = await requireContext();
  const rows = await getBestSellers(ctx.activeOrg.orgId);

  const columns: ReportColumn<Row>[] = [
    { key: "rank", label: "#", render: (r) => String(rows.indexOf(r) + 1) },
    { key: "name", label: "Product", render: (r) => (
      <span>{r.name} <span className="font-mono text-xs text-muted-foreground">{r.sku}</span></span>
    ) },
    { key: "units_sold", label: "Units sold", align: "right" },
    { key: "revenue", label: "Revenue", align: "right", render: (r) => money(r.revenue) },
  ];

  return (
    <ReportShell
      title="Best sellers"
      description="Top products by revenue, from fulfilled sales orders."
      filename="best-sellers"
      columns={columns}
      rows={rows}
      emptyMessage="No fulfilled sales yet."
    />
  );
}
