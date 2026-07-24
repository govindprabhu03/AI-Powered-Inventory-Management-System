import "server-only";

import { createClient } from "@/lib/supabase/server";

export type DashboardData = {
  totalProducts: number;
  inventoryCostValue: number;
  inventoryRetailValue: number;
  lowStockCount: number;
  totalRevenue: number;
  openPurchaseOrders: number;
  topSellers: { name: string; units: number }[];
  valueByProduct: { name: string; value: number }[];
  movementTrend: { date: string; in: number; out: number }[];
  recentMovements: {
    id: string;
    type: string;
    quantity: number;
    product: string;
    when: string;
  }[];
};

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

export async function getDashboardData(orgId: string): Promise<DashboardData> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [
    productsRes,
    valuationRes,
    lowStockRes,
    bestSellersRes,
    openPoRes,
    movementsRes,
    recentRes,
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("is_archived", false),
    supabase
      .from("stock_valuation")
      .select("name, cost_value, retail_value")
      .eq("org_id", orgId),
    supabase
      .from("low_stock")
      .select("product_id", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabase
      .from("best_sellers")
      .select("name, units_sold, revenue")
      .eq("org_id", orgId)
      .order("units_sold", { ascending: false })
      .limit(5),
    supabase
      .from("purchase_orders")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("status", ["draft", "pending_approval", "approved"]),
    supabase
      .from("stock_movements")
      .select("quantity, movement_type, created_at")
      .eq("org_id", orgId)
      .gte("created_at", since.toISOString()),
    supabase
      .from("stock_movements")
      .select("id, movement_type, quantity, created_at, products(name)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const valuation = valuationRes.data ?? [];
  const inventoryCostValue = valuation.reduce((s, v) => s + Number(v.cost_value), 0);
  const inventoryRetailValue = valuation.reduce((s, v) => s + Number(v.retail_value), 0);

  const bestSellers = bestSellersRes.data ?? [];
  const totalRevenue = bestSellers.reduce((s, b) => s + Number(b.revenue), 0);

  // Top 6 products by stock cost value, for the pie chart.
  const valueByProduct = [...valuation]
    .filter((v) => Number(v.cost_value) > 0)
    .sort((a, b) => Number(b.cost_value) - Number(a.cost_value))
    .slice(0, 6)
    .map((v) => ({ name: v.name ?? "—", value: Number(v.cost_value) }));

  // Build a 14-day in/out trend, bucketed by day.
  const buckets = new Map<string, { in: number; out: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    buckets.set(d.toISOString().slice(0, 10), { in: 0, out: 0 });
  }
  for (const m of movementsRes.data ?? []) {
    const day = m.created_at.slice(0, 10);
    const b = buckets.get(day);
    if (!b) continue;
    if (m.quantity > 0) b.in += m.quantity;
    else b.out += Math.abs(m.quantity);
  }
  const movementTrend = [...buckets.entries()].map(([date, v]) => ({
    date: date.slice(5), // MM-DD
    in: v.in,
    out: v.out,
  }));

  return {
    totalProducts: productsRes.count ?? 0,
    inventoryCostValue,
    inventoryRetailValue,
    lowStockCount: lowStockRes.count ?? 0,
    totalRevenue,
    openPurchaseOrders: openPoRes.count ?? 0,
    topSellers: bestSellers.map((b) => ({ name: b.name ?? "—", units: Number(b.units_sold) })),
    valueByProduct,
    movementTrend,
    recentMovements: (recentRes.data ?? []).map((m) => ({
      id: m.id,
      type: TYPE_LABEL[m.movement_type] ?? m.movement_type,
      quantity: m.quantity,
      product: m.products?.name ?? "—",
      when: m.created_at,
    })),
  };
}
