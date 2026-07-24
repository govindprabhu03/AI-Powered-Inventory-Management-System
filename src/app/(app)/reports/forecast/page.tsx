import { ReportShell, type ReportColumn } from "@/components/reports/report-shell";
import { Badge } from "@/components/ui/badge";
import { requireContext } from "@/lib/auth/context";
import { getProductForecasts, type ProductForecast } from "@/lib/data/forecast";

export const metadata = { title: "Demand forecast · Smart Inventory" };

const TREND_STYLE: Record<string, string> = {
  up: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  down: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  flat: "bg-muted text-muted-foreground",
};

export default async function ForecastReport() {
  const ctx = await requireContext();
  const rows = await getProductForecasts(ctx.activeOrg.orgId);

  const columns: ReportColumn<ProductForecast>[] = [
    {
      key: "name",
      label: "Product",
      render: (r) => (
        <span>
          {r.name} <span className="font-mono text-xs text-muted-foreground">{r.sku}</span>
        </span>
      ),
    },
    { key: "avgDailyDemand", label: "Avg/day", align: "right" },
    {
      key: "trend",
      label: "Trend",
      render: (r) => (
        <Badge className={`border-transparent ${TREND_STYLE[r.trend]}`}>
          {r.trend === "up" ? "↑ rising" : r.trend === "down" ? "↓ falling" : "→ steady"}
        </Badge>
      ),
    },
    { key: "available", label: "Available", align: "right" },
    {
      key: "daysOfCover",
      label: "Days of cover",
      align: "right",
      render: (r) => (r.daysOfCover === null ? "—" : String(r.daysOfCover)),
    },
    {
      key: "suggestedReorderQty",
      label: "Reorder",
      align: "right",
      render: (r) =>
        r.suggestedReorderQty > 0 ? (
          <span className="font-semibold text-primary">{r.suggestedReorderQty}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <ReportShell
      title="Demand forecast"
      description="Moving-average demand from the ledger, with reorder suggestions covering a 14-day lead time plus safety stock. Products with no recent sales are omitted."
      filename="demand-forecast"
      columns={columns}
      rows={rows}
      emptyMessage="Not enough sales history to forecast yet."
    />
  );
}
