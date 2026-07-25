/**
 * Seed a demo organization with realistic sample data.
 *
 *   node scripts/seed-demo.mjs           # create/reset the demo account + data
 *   node scripts/seed-demo.mjs delete    # remove it
 *
 * Requires SUPABASE_SECRET_KEY in .env (used only to create the confirmed demo
 * user and to reset it). Everything else is created through the normal
 * RLS-scoped, signed-in path — the same code a real user exercises.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = [".env.local", ".env"].map((f) => join(root, f)).find(existsSync);
const env = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.trimStart().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = "smartinventory.demo@gmail.com";
const PASSWORD = "demo-inventory-2026";

// Reset any existing demo user + org.
const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
const existing = list.users.find((u) => u.email === EMAIL);
if (existing) {
  await admin.from("organizations").delete().eq("created_by", existing.id);
  await admin.auth.admin.deleteUser(existing.id);
}
if (process.argv[2] === "delete") {
  console.log("Demo account removed.");
  process.exit(0);
}

await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { full_name: "Demo Manager" },
});

const sb = createClient(URL, ANON, {
  auth: { autoRefreshToken: false, persistSession: false },
});
await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
const stamp = Date.now();

const { data: org } = await sb.rpc("create_organization", {
  p_name: "Bright Bazaar",
  p_slug: `bright-bazaar-${stamp}`,
});

const { data: whMain } = await sb.from("warehouses").insert({ org_id: org.id, name: "Main Warehouse" }).select("id").single();
await sb.from("warehouses").insert({ org_id: org.id, name: "North Branch" });

const { data: elec } = await sb.from("categories").insert({ org_id: org.id, name: "Electronics" }).select("id").single();
await sb.from("categories").insert({ org_id: org.id, name: "Accessories", parent_id: elec.id });
const { data: home } = await sb.from("categories").insert({ org_id: org.id, name: "Home & Kitchen" }).select("id").single();

const { data: sup1 } = await sb.from("suppliers").insert({ org_id: org.id, company_name: "Global Traders Pvt Ltd", contact_person: "Ravi Kumar", email: "ravi@globaltraders.example", phone: "+91 98765 43210" }).select("id").single();
await sb.from("suppliers").insert({ org_id: org.id, company_name: "MetroWholesale Co", email: "sales@metrowholesale.example" });

const { data: cust1 } = await sb.from("customers").insert({ org_id: org.id, name: "Corner Store", email: "orders@cornerstore.example" }).select("id").single();
await sb.from("customers").insert({ org_id: org.id, name: "City Mart", phone: "+91 90000 11111" });

const productDefs = [
  { name: "Wireless Mouse", sku: "WM-100", barcode: "8901234500011", cat: elec.id, sup: sup1.id, cost: 350, sell: 599, reorder: 40, stock: 120 },
  { name: "USB-C Cable 1m", sku: "CBL-USBC-1", barcode: "8901234500028", cat: elec.id, sup: sup1.id, cost: 80, sell: 149, reorder: 100, stock: 60 }, // low
  { name: "Bluetooth Speaker", sku: "SPK-BT-20", barcode: "8901234500035", cat: elec.id, sup: sup1.id, cost: 900, sell: 1499, reorder: 20, stock: 45 },
  { name: "Steel Water Bottle", sku: "HK-BTL-750", barcode: "8901234500042", cat: home.id, sup: null, cost: 220, sell: 399, reorder: 50, stock: 200 },
  { name: "Ceramic Mug Set", sku: "HK-MUG-4", barcode: "8901234500059", cat: home.id, sup: null, cost: 300, sell: 549, reorder: 30, stock: 25 }, // low
];

const ids = {};
for (const p of productDefs) {
  const { data: prod } = await sb.from("products").insert({
    org_id: org.id, name: p.name, sku: p.sku, barcode: p.barcode,
    category_id: p.cat, supplier_id: p.sup, cost_price: p.cost, selling_price: p.sell, reorder_level: p.reorder,
  }).select("id").single();
  ids[p.sku] = prod.id;
  await sb.from("stock_movements").insert({ org_id: org.id, product_id: prod.id, warehouse_id: whMain.id, movement_type: "stock_in", quantity: p.stock });
}

// Backdated demand so forecasting + best-sellers + charts have history.
for (let d = 30; d >= 1; d--) {
  const when = new Date(Date.now() - d * 86400000).toISOString();
  await sb.from("stock_movements").insert({ org_id: org.id, product_id: ids["WM-100"], warehouse_id: whMain.id, movement_type: "stock_out", quantity: -(d <= 7 ? 4 : 2), created_at: when });
  if (d % 2 === 0) await sb.from("stock_movements").insert({ org_id: org.id, product_id: ids["HK-BTL-750"], warehouse_id: whMain.id, movement_type: "stock_out", quantity: -3, created_at: when });
}

// A completed purchase order (approved + received) and a fulfilled sale.
const { data: po } = await sb.rpc("create_purchase_order", {
  p_supplier_id: sup1.id, p_warehouse_id: whMain.id,
  p_items: [{ product_id: ids["CBL-USBC-1"], quantity: 200, unit_cost: 80 }],
});
await sb.rpc("submit_purchase_order", { p_id: po.id });
await sb.rpc("approve_purchase_order", { p_id: po.id });

const { data: so } = await sb.rpc("create_sales_order", {
  p_customer_id: cust1.id, p_warehouse_id: whMain.id,
  p_items: [{ product_id: ids["SPK-BT-20"], quantity: 10, unit_price: 1499 }, { product_id: ids["HK-BTL-750"], quantity: 30, unit_price: 399 }],
});
await sb.rpc("confirm_sales_order", { p_id: so.id });
await sb.rpc("fulfil_sales_order", { p_id: so.id });

console.log("Demo account seeded:");
console.log(`  email:    ${EMAIL}`);
console.log(`  password: ${PASSWORD}`);
console.log("  org:      Bright Bazaar (2 warehouses, 5 products, orders, 30d demand history)");
