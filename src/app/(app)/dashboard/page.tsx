import { requireContext } from "@/lib/auth/context";

export const metadata = { title: "Dashboard · Smart Inventory" };

export default async function DashboardPage() {
  const ctx = await requireContext();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-8 py-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {ctx.activeOrg.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Welcome back{ctx.fullName ? `, ${ctx.fullName}` : ""}.
        </p>
      </div>

      {/* KPI cards land in Phase 5 once there is stock and sales data to show. */}
      <div className="rounded-lg border border-dashed px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Your dashboard will fill in as you add products and record stock.
        </p>
      </div>
    </div>
  );
}
