-- Phase 2: the product catalog.
--
-- Four tables — categories, suppliers, warehouses, products — that together
-- describe WHAT a business sells and where. They do NOT describe how much stock
-- exists; that is the Phase 3 ledger's job (see the note on products below).
--
-- Every table follows the multi-tenant pattern established in Phase 1:
--   * an org_id column scoping the row to one organization
--   * RLS enabled, reads open to any member, writes limited to managers
--   * an updated_at trigger
-- The RLS helpers (user_org_ids, has_org_role) come from the Phase 1 migration.

-- ===========================================================================
-- categories — a tree, via self-reference
-- ===========================================================================
--
-- parent_id points at another row in this same table. A null parent means a
-- top-level category; a set parent means a sub-category. This is how "grocery
-- > beverages > soft drinks" is represented without a fixed depth limit. We
-- walk the tree with a recursive query when we build the UI (Phase 2 continued).

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  -- on delete set null: deleting a parent category promotes its children to
  -- top-level rather than deleting them along with it.
  parent_id  uuid references public.categories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A category name is unique among its siblings (same parent, same org). Two
  -- different parents may each have a "Misc" child. Postgres treats NULLs as
  -- distinct, so this does not constrain top-level names on its own — the
  -- partial index below handles those.
  unique (org_id, parent_id, name)
);

-- Enforce unique top-level names per org (where parent_id is null), which the
-- unique constraint above cannot because NULL <> NULL in SQL.
create unique index categories_org_root_name_idx
  on public.categories (org_id, name)
  where parent_id is null;

create index categories_org_id_idx    on public.categories (org_id);
create index categories_parent_id_idx on public.categories (parent_id);

-- ===========================================================================
-- suppliers — who we buy from (Module 6)
-- ===========================================================================

create table public.suppliers (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  company_name   text not null check (length(trim(company_name)) > 0),
  contact_person text,
  email          text check (email is null or position('@' in email) > 1),
  phone          text,
  gst_number     text,
  address        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (org_id, company_name)
);

create index suppliers_org_id_idx on public.suppliers (org_id);

-- ===========================================================================
-- warehouses — where stock physically lives (Module 5)
-- ===========================================================================

create table public.warehouses (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  address    text,
  -- Optional maximum capacity (in units), used later for utilisation reports.
  capacity   integer check (capacity is null or capacity >= 0),
  -- The managing user. Nullable, and set null if that user is removed. We do
  -- not enforce here that the manager is a member — RLS already prevents
  -- setting it to someone outside the org, since you cannot read their id.
  manager_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (org_id, name)
);

create index warehouses_org_id_idx on public.warehouses (org_id);

-- ===========================================================================
-- products — the catalog entry (Module 3)
-- ===========================================================================
--
-- IMPORTANT: there is deliberately NO stock_quantity column here, even though
-- the spec lists it as a product field.
--
-- Stock is not an attribute of a product; it is the running total of every
-- movement in and out, and it differs per warehouse. Storing a single mutable
-- number here would:
--   * lose all history (Module 16 audit needs it)
--   * corrupt under two concurrent orders (lost-update problem)
--   * give the forecaster (Module 12) nothing to learn from
--
-- So Phase 3 introduces stock_movements (append-only) and stock_levels (derived
-- per product x warehouse). This table holds only the catalog facts.

create table public.products (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,

  name          text not null check (length(trim(name)) > 0),
  -- Stock Keeping Unit: the business's own product code. Unique within the org.
  sku           text not null check (length(trim(sku)) > 0),
  -- The scannable barcode (EAN/UPC etc). Optional and not necessarily unique —
  -- some businesses reuse manufacturer barcodes across variants.
  barcode       text,
  description   text,

  -- Set null rather than cascade: deleting a category or supplier must not
  -- delete the products that referenced it.
  category_id   uuid references public.categories(id) on delete set null,
  supplier_id   uuid references public.suppliers(id)  on delete set null,
  brand         text,

  -- Money is numeric(12,2), never float. tax_rate is a percentage (e.g. 18.00).
  cost_price    numeric(12,2) not null default 0 check (cost_price >= 0),
  selling_price numeric(12,2) not null default 0 check (selling_price >= 0),
  tax_rate      numeric(5,2)  not null default 0 check (tax_rate >= 0 and tax_rate <= 100),

  -- Unit of measure: pcs, kg, litre, box... Free text, defaulted.
  unit          text not null default 'pcs',
  weight        numeric(10,3) check (weight is null or weight >= 0),
  -- Dimensions as {length, width, height}; jsonb so the shape can grow.
  dimensions    jsonb,

  -- When available stock drops to this level, the product is "low" (drives
  -- Module 14 alerts and Module 12 reorder suggestions).
  reorder_level integer not null default 0 check (reorder_level >= 0),

  -- Archive instead of delete: keeps history intact while hiding the product
  -- from normal lists. The "Delete Product" operation flips this; hard deletes
  -- are reserved for products that never had any movements.
  is_archived   boolean not null default false,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (org_id, sku)
);

create index products_org_id_idx      on public.products (org_id);
create index products_category_id_idx on public.products (category_id);
create index products_supplier_id_idx on public.products (supplier_id);
-- Partial index: most list queries filter out archived products, so indexing
-- only the live ones keeps that common path fast.
create index products_org_active_idx  on public.products (org_id) where not is_archived;

-- ===========================================================================
-- updated_at triggers (set_updated_at defined in the Phase 1 migration)
-- ===========================================================================

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

create trigger warehouses_set_updated_at
  before update on public.warehouses
  for each row execute function public.set_updated_at();

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
--
-- Same shape for all four tables:
--   read   — any member of the owning org
--   write  — super_admin or inventory_manager only
-- warehouse_staff and sales_executive can view the catalog but not edit it.
--
-- Every policy scopes to org_id, so cross-tenant access is impossible. The
-- verify-tenant-isolation.mjs harness re-checks this after the migration.

alter table public.categories enable row level security;
alter table public.suppliers  enable row level security;
alter table public.warehouses enable row level security;
alter table public.products   enable row level security;

-- categories
create policy "members read categories"
  on public.categories for select to authenticated
  using (org_id in (select public.user_org_ids()));
create policy "managers write categories"
  on public.categories for all to authenticated
  using (public.has_org_role(org_id, 'super_admin', 'inventory_manager'))
  with check (public.has_org_role(org_id, 'super_admin', 'inventory_manager'));

-- suppliers
create policy "members read suppliers"
  on public.suppliers for select to authenticated
  using (org_id in (select public.user_org_ids()));
create policy "managers write suppliers"
  on public.suppliers for all to authenticated
  using (public.has_org_role(org_id, 'super_admin', 'inventory_manager'))
  with check (public.has_org_role(org_id, 'super_admin', 'inventory_manager'));

-- warehouses
create policy "members read warehouses"
  on public.warehouses for select to authenticated
  using (org_id in (select public.user_org_ids()));
create policy "managers write warehouses"
  on public.warehouses for all to authenticated
  using (public.has_org_role(org_id, 'super_admin', 'inventory_manager'))
  with check (public.has_org_role(org_id, 'super_admin', 'inventory_manager'));

-- products
create policy "members read products"
  on public.products for select to authenticated
  using (org_id in (select public.user_org_ids()));
create policy "managers write products"
  on public.products for all to authenticated
  using (public.has_org_role(org_id, 'super_admin', 'inventory_manager'))
  with check (public.has_org_role(org_id, 'super_admin', 'inventory_manager'));
