import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getProductForecasts } from "@/lib/data/forecast";
import type { Database } from "@/lib/database.types";

/**
 * The assistant's toolset.
 *
 * The AI NEVER writes SQL. It can only pick from these fixed tools and supply
 * structured arguments; each executor runs a safe, parameterised query through
 * the RLS-bound server client, so it can only ever read the caller's own
 * organization. This is both safer (no injection, no hallucinated columns) and
 * more reliable than letting a model emit raw SQL.
 */

export type ToolContext = {
  supabase: SupabaseClient<Database>;
  orgId: string;
};

export type Tool = {
  declaration: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
};

const noArgs = { type: "object", properties: {} };

export const tools: Tool[] = [
  {
    declaration: {
      name: "get_low_stock",
      description:
        "List products at or below their reorder level (name, sku, available quantity, reorder level).",
      parameters: noArgs,
    },
    execute: async (_a, { supabase, orgId }) => {
      const { data } = await supabase
        .from("low_stock")
        .select("name, sku, available, reorder_level")
        .eq("org_id", orgId)
        .order("available");
      return { count: data?.length ?? 0, products: data ?? [] };
    },
  },
  {
    declaration: {
      name: "get_dead_stock",
      description:
        "List products that have stock on hand but no sale in the last 90 days, with the capital tied up (cost_value).",
      parameters: noArgs,
    },
    execute: async (_a, { supabase, orgId }) => {
      const { data } = await supabase
        .from("dead_stock")
        .select("name, sku, on_hand, cost_value, last_sold_at")
        .eq("org_id", orgId)
        .order("cost_value", { ascending: false });
      return { count: data?.length ?? 0, products: data ?? [] };
    },
  },
  {
    declaration: {
      name: "get_inventory_value",
      description:
        "Total value of on-hand inventory at cost and at retail, and the product count.",
      parameters: noArgs,
    },
    execute: async (_a, { supabase, orgId }) => {
      const { data } = await supabase
        .from("stock_valuation")
        .select("cost_value, retail_value")
        .eq("org_id", orgId);
      const cost = (data ?? []).reduce((s, r) => s + Number(r.cost_value), 0);
      const retail = (data ?? []).reduce((s, r) => s + Number(r.retail_value), 0);
      return { product_count: data?.length ?? 0, total_cost_value: cost, total_retail_value: retail };
    },
  },
  {
    declaration: {
      name: "get_best_sellers",
      description:
        "Top products by revenue from fulfilled sales orders (name, units sold, revenue).",
      parameters: noArgs,
    },
    execute: async (_a, { supabase, orgId }) => {
      const { data } = await supabase
        .from("best_sellers")
        .select("name, sku, units_sold, revenue")
        .eq("org_id", orgId)
        .order("revenue", { ascending: false })
        .limit(10);
      return { products: data ?? [] };
    },
  },
  {
    declaration: {
      name: "find_product",
      description:
        "Find a product by a partial name or SKU. Returns matches with sku and current on-hand quantity.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Part of the product name or SKU" },
        },
        required: ["query"],
      },
    },
    execute: async (args, { supabase, orgId }) => {
      const q = String(args.query ?? "").replace(/[%_\\]/g, "").slice(0, 60);
      const { data } = await supabase
        .from("products")
        .select("name, sku, stock_levels(on_hand)")
        .eq("org_id", orgId)
        .eq("is_archived", false)
        .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
        .limit(8);
      const products = (data ?? []).map((p) => ({
        name: p.name,
        sku: p.sku,
        on_hand: (p.stock_levels ?? []).reduce(
          (s: number, l: { on_hand: number }) => s + l.on_hand,
          0,
        ),
      }));
      return { products };
    },
  },
  {
    declaration: {
      name: "get_reorder_suggestions",
      description:
        "Products that should be reordered, with the statistically suggested quantity (avg daily demand, days of cover, suggested reorder quantity, trend). Use this to answer what to restock.",
      parameters: noArgs,
    },
    execute: async (_a, { orgId }) => {
      const forecasts = await getProductForecasts(orgId);
      const needing = forecasts
        .filter((f) => f.suggestedReorderQty > 0)
        .map((f) => ({
          name: f.name,
          sku: f.sku,
          available: f.available,
          avg_daily_demand: f.avgDailyDemand,
          days_of_cover: f.daysOfCover,
          suggested_reorder_qty: f.suggestedReorderQty,
          trend: f.trend,
        }));
      return { count: needing.length, products: needing };
    },
  },
];

export const toolsByName = Object.fromEntries(tools.map((t) => [t.declaration.name, t]));
