import "server-only";

import { createClient } from "@/lib/supabase/server";
import { forecast, toDailySeries, type Forecast } from "@/lib/forecast";

const WINDOW_DAYS = 60;

export type ProductForecast = {
  productId: string;
  name: string;
  sku: string;
  available: number;
  incoming: number;
  reorderLevel: number;
} & Forecast;

/**
 * Compute a forecast for every product with recent outward demand, from the
 * ledger. Reused by the forecast report and the AI's reorder tool.
 */
export async function getProductForecasts(
  orgId: string,
): Promise<ProductForecast[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString();

  const [{ data: products }, { data: outs }, { data: levels }, { data: incomingRows }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, sku, reorder_level")
        .eq("org_id", orgId)
        .eq("is_archived", false),
      supabase
        .from("stock_movements")
        .select("product_id, quantity, created_at")
        .eq("org_id", orgId)
        .eq("movement_type", "stock_out")
        .gte("created_at", since),
      supabase.from("stock_levels").select("product_id, available").eq("org_id", orgId),
      supabase
        .from("purchase_order_items")
        .select("product_id, quantity, purchase_orders!inner(status)")
        .eq("org_id", orgId)
        .eq("purchase_orders.status", "approved"),
    ]);

  // Aggregate available per product (across warehouses).
  const availableByProduct = new Map<string, number>();
  for (const l of levels ?? []) {
    availableByProduct.set(
      l.product_id,
      (availableByProduct.get(l.product_id) ?? 0) + (l.available ?? 0),
    );
  }
  const incomingByProduct = new Map<string, number>();
  for (const r of incomingRows ?? []) {
    incomingByProduct.set(
      r.product_id,
      (incomingByProduct.get(r.product_id) ?? 0) + r.quantity,
    );
  }
  // stock_out quantities are negative; demand is their magnitude.
  const eventsByProduct = new Map<string, { date: string; qty: number }[]>();
  for (const m of outs ?? []) {
    const list = eventsByProduct.get(m.product_id) ?? [];
    list.push({ date: m.created_at, qty: Math.abs(m.quantity) });
    eventsByProduct.set(m.product_id, list);
  }

  const result: ProductForecast[] = [];
  for (const p of products ?? []) {
    const events = eventsByProduct.get(p.id) ?? [];
    if (events.length === 0) continue; // no demand history to forecast from
    const available = availableByProduct.get(p.id) ?? 0;
    const incoming = incomingByProduct.get(p.id) ?? 0;
    const series = toDailySeries(events, WINDOW_DAYS);
    const f = forecast({ dailyDemand: series, available, incoming });
    result.push({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      available,
      incoming,
      reorderLevel: p.reorder_level,
      ...f,
    });
  }

  // Most urgent first: those needing a reorder, by suggested quantity.
  result.sort((a, b) => b.suggestedReorderQty - a.suggestedReorderQty);
  return result;
}
