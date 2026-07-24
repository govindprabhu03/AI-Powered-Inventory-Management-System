import Link from "next/link";
import { Coins, LineChart, PackageX, TrendingDown, Trophy } from "lucide-react";

import { requireContext } from "@/lib/auth/context";

export const metadata = { title: "Reports · Smart Inventory" };

const REPORTS = [
  { href: "/reports/stock-valuation", title: "Stock valuation", desc: "What your on-hand inventory is worth, at cost and retail.", icon: Coins },
  { href: "/reports/low-stock", title: "Low stock", desc: "Products at or below their reorder level.", icon: TrendingDown },
  { href: "/reports/dead-stock", title: "Dead stock", desc: "Stock on hand that hasn't sold in 90 days.", icon: PackageX },
  { href: "/reports/best-sellers", title: "Best sellers", desc: "Top products by units sold and revenue.", icon: Trophy },
  { href: "/reports/forecast", title: "Demand forecast", desc: "Projected demand and reorder suggestions from the ledger.", icon: LineChart },
];

export default async function ReportsPage() {
  await requireContext();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-8 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Every report is scoped to your organization and exportable as CSV.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {REPORTS.map(({ href, title, desc, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
          >
            <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">{title}</p>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
