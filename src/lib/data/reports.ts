import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getStockValuation(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stock_valuation")
    .select("name, sku, on_hand, cost_price, selling_price, cost_value, retail_value")
    .eq("org_id", orgId)
    .order("cost_value", { ascending: false });
  return data ?? [];
}

export async function getLowStock(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("low_stock")
    .select("name, sku, available, reorder_level")
    .eq("org_id", orgId)
    .order("available", { ascending: true });
  return data ?? [];
}

export async function getDeadStock(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("dead_stock")
    .select("name, sku, on_hand, cost_value, last_sold_at")
    .eq("org_id", orgId)
    .order("cost_value", { ascending: false });
  return data ?? [];
}

export async function getBestSellers(orgId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("best_sellers")
    .select("name, sku, units_sold, revenue")
    .eq("org_id", orgId)
    .order("revenue", { ascending: false });
  return data ?? [];
}
