-- Phase 5: reporting views.
--
-- A view is a saved query you can select from like a table. It keeps report
-- logic in one place and lets Postgres optimise it.
--
-- CRITICAL: every view here is created WITH (security_invoker = true). By
-- default a view runs with its OWNER's privileges, which would bypass RLS and
-- expose every organization's data. security_invoker makes the underlying
-- tables' RLS apply as the QUERYING user instead — so these reports stay scoped
-- to the caller's organizations exactly like a direct table query. (Requires
-- Postgres 15+, which Supabase provides.)

-- ===========================================================================
-- stock_valuation — what the on-hand inventory is worth
-- ===========================================================================
--
-- Aggregates on-hand across warehouses per product and values it at both cost
-- (what we paid) and retail (what we'd sell it for). Archived products are
-- excluded — they're not part of the live catalog.

create view public.stock_valuation
with (security_invoker = true) as
select
  p.org_id,
  p.id            as product_id,
  p.name,
  p.sku,
  p.unit,
  p.cost_price,
  p.selling_price,
  coalesce(sum(sl.on_hand), 0)                     as on_hand,
  coalesce(sum(sl.on_hand) * p.cost_price, 0)      as cost_value,
  coalesce(sum(sl.on_hand) * p.selling_price, 0)   as retail_value
from public.products p
left join public.stock_levels sl on sl.product_id = p.id
where not p.is_archived
group by p.id;

-- ===========================================================================
-- low_stock — products at or below their reorder level
-- ===========================================================================
--
-- Compares TOTAL available across warehouses with reorder_level. Only products
-- with a reorder_level set (> 0) can be "low".

create view public.low_stock
with (security_invoker = true) as
select
  p.org_id,
  p.id           as product_id,
  p.name,
  p.sku,
  p.reorder_level,
  coalesce(sum(sl.available), 0) as available
from public.products p
left join public.stock_levels sl on sl.product_id = p.id
where not p.is_archived
  and p.reorder_level > 0
group by p.id
having coalesce(sum(sl.available), 0) <= p.reorder_level;

-- ===========================================================================
-- best_sellers — units and revenue from fulfilled sales orders
-- ===========================================================================

create view public.best_sellers
with (security_invoker = true) as
select
  p.org_id,
  p.id                                   as product_id,
  p.name,
  p.sku,
  sum(soi.quantity)                      as units_sold,
  sum(soi.quantity * soi.unit_price)     as revenue
from public.sales_order_items soi
join public.sales_orders so on so.id = soi.sales_order_id
join public.products p      on p.id = soi.product_id
where so.status = 'fulfilled'
group by p.id;

-- ===========================================================================
-- dead_stock — has stock on hand but no outward sale in 90 days
-- ===========================================================================
--
-- "Dead" = still holding units (money tied up) that aren't moving. We look for
-- products with positive on-hand whose most recent stock_out is older than 90
-- days, or that have never had a stock_out at all.

create view public.dead_stock
with (security_invoker = true) as
select
  v.org_id,
  v.product_id,
  v.name,
  v.sku,
  v.on_hand,
  v.cost_value,
  (
    select max(sm.created_at)
    from public.stock_movements sm
    where sm.product_id = v.product_id
      and sm.movement_type = 'stock_out'
  ) as last_sold_at
from public.stock_valuation v
where v.on_hand > 0
  and coalesce(
    (
      select max(sm.created_at)
      from public.stock_movements sm
      where sm.product_id = v.product_id
        and sm.movement_type = 'stock_out'
    ),
    'epoch'::timestamptz
  ) < now() - interval '90 days';

-- ===========================================================================
-- Supporting index
-- ===========================================================================
--
-- The dead_stock subqueries filter movements by product_id + movement_type.
-- A partial index on stock_out movements keeps that lookup fast as the ledger
-- grows into the thousands of rows.

create index stock_movements_product_out_idx
  on public.stock_movements (product_id, created_at desc)
  where movement_type = 'stock_out';
