import Link from "next/link";

import {
  MovementTrendChart,
  TopSellersChart,
  ValuePieChart,
} from "@/components/dashboard/charts";
import { Badge } from "@/components/ui/badge";
import { requireContext } from "@/lib/auth/context";
import { getDashboardData } from "@/lib/data/dashboard";

export const metadata = { title: "Dashboard · Smart Inventory" };

const money = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export default async function DashboardPage() {
  const ctx = await requireContext();
  const d = await getDashboardData(ctx.activeOrg.orgId);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-8 py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{ctx.activeOrg.name}</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back{ctx.fullName ? `, ${ctx.fullName}` : ""}.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi label="Products" value={String(d.totalProducts)} />
        <Kpi label="Inventory value (cost)" value={money(d.inventoryCostValue)} />
        <Kpi
          label="Low stock"
          value={String(d.lowStockCount)}
          accent={d.lowStockCount > 0 ? "warn" : undefined}
          href={d.lowStockCount > 0 ? "/reports/low-stock" : undefined}
        />
        <Kpi label="Sales revenue" value={money(d.totalRevenue)} />
        <Kpi label="Open purchase orders" value={String(d.openPurchaseOrders)} href="/purchases" />
        <Kpi label="Retail value" value={money(d.inventoryRetailValue)} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Stock movement (14 days)">
          <MovementTrendChart data={d.movementTrend} />
        </Panel>
        <Panel title="Inventory value by product">
          <ValuePieChart data={d.valueByProduct} />
        </Panel>
        <Panel title="Best sellers" className="lg:col-span-2">
          <TopSellersChart data={d.topSellers} />
        </Panel>
      </div>

      {/* Recent activity */}
      <Panel title="Recent stock activity">
        {d.recentMovements.length > 0 ? (
          <ul className="divide-y">
            {d.recentMovements.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Badge variant="secondary">{m.type}</Badge>
                  <span className="font-medium">{m.product}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span
                    className={`tabular-nums font-medium ${
                      m.quantity > 0 ? "text-green-600 dark:text-green-500" : "text-destructive"
                    }`}
                  >
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(m.when).toLocaleString()}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No stock activity yet. It will appear here as you record movements.
          </p>
        )}
      </Panel>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: string;
  accent?: "warn";
  href?: string;
}) {
  const inner = (
    <div
      className={`rounded-lg border p-4 ${
        accent === "warn" ? "border-amber-300 dark:border-amber-800" : ""
      } ${href ? "transition-colors hover:bg-muted/50" : ""}`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${className ?? ""}`}>
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      {children}
    </div>
  );
}
