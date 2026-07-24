-- Phase 5: global search.
--
-- Why not just ILIKE '%term%'? Because a LEADING wildcard defeats a normal
-- B-tree index — Postgres would scan every row and substring-match each one.
-- Fine at a hundred products, slow at a hundred thousand.
--
-- The fix is a TRIGRAM index. pg_trgm breaks text into 3-character grams and a
-- GIN index over them lets Postgres jump straight to candidate rows for a
-- substring/fuzzy match. So ILIKE '%bolt%' becomes an index lookup, not a full
-- scan. (Full-text search / tsvector is the other tool, but it stems whole
-- words and is a poor fit for SKUs, barcodes and order numbers — identifiers,
-- not prose. Trigram is right for this.)

create extension if not exists pg_trgm;

-- One GIN trigram index per searchable identifier/name column.
create index products_name_trgm    on public.products   using gin (name gin_trgm_ops);
create index products_sku_trgm     on public.products   using gin (sku gin_trgm_ops);
create index products_barcode_trgm on public.products   using gin (barcode gin_trgm_ops);
create index suppliers_name_trgm   on public.suppliers  using gin (company_name gin_trgm_ops);
create index customers_name_trgm   on public.customers  using gin (name gin_trgm_ops);
create index po_number_trgm        on public.purchase_orders using gin (order_number gin_trgm_ops);
create index so_number_trgm        on public.sales_orders    using gin (order_number gin_trgm_ops);

-- ===========================================================================
-- global_search — one RPC, unified results across the app
-- ===========================================================================
--
-- SECURITY INVOKER (default), so each inner query runs under the caller's RLS
-- and only ever returns their org's rows. We also filter on p_org_id to scope
-- to the ACTIVE org. User input is escaped so % and _ are literal, not wildcards.

create or replace function public.global_search(p_org_id uuid, p_query text)
returns table (kind text, id uuid, title text, subtitle text, url text)
language sql
stable
set search_path = public
as $$
  with q as (
    select '%' ||
      replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_')
      || '%' as pat
  )
  (
    select 'product'::text, p.id, p.name,
           'SKU ' || p.sku || coalesce(' · ' || p.barcode, ''),
           '/products/' || p.id || '/edit'
    from products p, q
    where p.org_id = p_org_id
      and not p.is_archived
      and (p.name ilike q.pat or p.sku ilike q.pat or coalesce(p.barcode, '') ilike q.pat)
    limit 6
  )
  union all
  (
    select 'supplier'::text, s.id, s.company_name,
           coalesce(s.email, s.phone, ''),
           '/suppliers/' || s.id || '/edit'
    from suppliers s, q
    where s.org_id = p_org_id and s.company_name ilike q.pat
    limit 4
  )
  union all
  (
    select 'customer'::text, c.id, c.name,
           coalesce(c.email, c.phone, ''),
           '/customers/' || c.id || '/edit'
    from customers c, q
    where c.org_id = p_org_id and c.name ilike q.pat
    limit 4
  )
  union all
  (
    select 'purchase_order'::text, po.id, po.order_number,
           sup.company_name,
           '/purchases/' || po.id
    from purchase_orders po
    join suppliers sup on sup.id = po.supplier_id, q
    where po.org_id = p_org_id and po.order_number ilike q.pat
    limit 4
  )
  union all
  (
    select 'sales_order'::text, so.id, so.order_number,
           cust.name,
           '/sales/' || so.id
    from sales_orders so
    join customers cust on cust.id = so.customer_id, q
    where so.org_id = p_org_id and so.order_number ilike q.pat
    limit 4
  );
$$;

revoke all on function public.global_search(uuid, text) from public, anon;
grant execute on function public.global_search(uuid, text) to authenticated;
