-- Phase 4: purchases & sales — the shape of the data.
--
-- Orders are STATE MACHINES. A purchase order moves
--   draft -> pending_approval -> approved -> received     (or -> cancelled)
-- and a sales order moves
--   draft -> confirmed -> fulfilled                       (or -> cancelled)
--
-- The enforcement strategy is the strongest one available: the order tables
-- have SELECT policies only. There is no INSERT, UPDATE or DELETE policy at
-- all, so no client can create an order row directly, edit a status by hand,
-- or delete history. Every mutation goes through the workflow functions in the
-- next migration, which check the caller's role and the current state before
-- performing a legal transition. Illegal states aren't "prevented by the UI" —
-- they are unrepresentable.

-- ===========================================================================
-- Enums
-- ===========================================================================

create type public.purchase_order_status as enum (
  'draft', 'pending_approval', 'approved', 'received', 'cancelled'
);

create type public.sales_order_status as enum (
  'draft', 'confirmed', 'fulfilled', 'cancelled'
);

create type public.payment_status as enum ('unpaid', 'partial', 'paid');

-- ===========================================================================
-- Per-org order numbering
-- ===========================================================================
--
-- Humans need "PO-0007", not a uuid. Sequential numbers per org require a
-- counter that increments atomically; UPDATE ... RETURNING on these columns
-- (done inside the workflow functions) is race-safe because the row update
-- takes a lock.

alter table public.organizations
  add column po_seq integer not null default 0,
  add column so_seq integer not null default 0;

-- ===========================================================================
-- customers — who we sell to (Module 9)
-- ===========================================================================

create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  email      text check (email is null or position('@' in email) > 1),
  phone      text,
  address    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (org_id, name)
);

create index customers_org_id_idx on public.customers (org_id);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

alter table public.customers enable row level security;

create policy "members read customers"
  on public.customers for select to authenticated
  using (org_id in (select public.user_org_ids()));

-- Customers are simple CRUD (no multi-row transactions), so normal write
-- policies are fine here — sales roles and up.
create policy "sales roles write customers"
  on public.customers for all to authenticated
  using (public.has_org_role(org_id, 'super_admin', 'inventory_manager', 'sales_executive'))
  with check (public.has_org_role(org_id, 'super_admin', 'inventory_manager', 'sales_executive'));

-- ===========================================================================
-- Purchase orders (Module 8)
-- ===========================================================================

create table public.purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  order_number  text not null,
  supplier_id   uuid not null references public.suppliers(id)  on delete restrict,
  -- The warehouse that will receive the goods.
  warehouse_id  uuid not null references public.warehouses(id) on delete restrict,

  status          public.purchase_order_status not null default 'draft',
  payment_status  public.payment_status        not null default 'unpaid',

  notes         text,
  expected_date date,

  created_by    uuid not null default auth.uid(),
  approved_by   uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  approved_at   timestamptz,
  received_at   timestamptz,

  unique (org_id, order_number)
);

create index purchase_orders_org_id_idx   on public.purchase_orders (org_id);
create index purchase_orders_status_idx   on public.purchase_orders (org_id, status);
create index purchase_orders_supplier_idx on public.purchase_orders (supplier_id);

create table public.purchase_order_items (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  purchase_order_id  uuid not null references public.purchase_orders(id) on delete cascade,
  product_id         uuid not null references public.products(id) on delete restrict,
  quantity           integer not null check (quantity > 0),
  unit_cost          numeric(12,2) not null check (unit_cost >= 0),

  unique (purchase_order_id, product_id)
);

create index purchase_order_items_po_idx on public.purchase_order_items (purchase_order_id);

alter table public.purchase_orders      enable row level security;
alter table public.purchase_order_items enable row level security;

-- Read-only from the client. All writes go through the workflow functions.
create policy "members read purchase orders"
  on public.purchase_orders for select to authenticated
  using (org_id in (select public.user_org_ids()));

create policy "members read purchase order items"
  on public.purchase_order_items for select to authenticated
  using (org_id in (select public.user_org_ids()));

-- ===========================================================================
-- Sales orders (Module 9)
-- ===========================================================================

create table public.sales_orders (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  order_number  text not null,
  customer_id   uuid not null references public.customers(id)  on delete restrict,
  -- The warehouse the goods ship from; confirming reserves stock here.
  warehouse_id  uuid not null references public.warehouses(id) on delete restrict,

  status          public.sales_order_status not null default 'draft',
  payment_status  public.payment_status     not null default 'unpaid',

  notes         text,

  created_by    uuid not null default auth.uid(),
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz,
  fulfilled_at  timestamptz,

  unique (org_id, order_number)
);

create index sales_orders_org_id_idx   on public.sales_orders (org_id);
create index sales_orders_status_idx   on public.sales_orders (org_id, status);
create index sales_orders_customer_idx on public.sales_orders (customer_id);

create table public.sales_order_items (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  sales_order_id  uuid not null references public.sales_orders(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete restrict,
  quantity        integer not null check (quantity > 0),
  unit_price      numeric(12,2) not null check (unit_price >= 0),

  unique (sales_order_id, product_id)
);

create index sales_order_items_so_idx on public.sales_order_items (sales_order_id);

alter table public.sales_orders      enable row level security;
alter table public.sales_order_items enable row level security;

create policy "members read sales orders"
  on public.sales_orders for select to authenticated
  using (org_id in (select public.user_org_ids()));

create policy "members read sales order items"
  on public.sales_order_items for select to authenticated
  using (org_id in (select public.user_org_ids()));

-- ===========================================================================
-- Ledger upgrade: reservations become inviolable
-- ===========================================================================
--
-- Until now the trigger only forbade negative on-hand. With sales orders
-- reserving stock, the invariant strengthens to: on_hand >= reserved, always.
-- A direct stock-out, damage write-off or transfer can no longer consume
-- units that are promised to a confirmed order — the fulfilment path first
-- releases the reservation and then posts its movement, all in one
-- transaction, so it alone can spend reserved stock.

create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_on_hand  integer;
  v_reserved integer;
begin
  if not exists (
    select 1 from products
    where id = new.product_id and org_id = new.org_id
  ) then
    raise exception 'Product does not belong to this organization';
  end if;

  if not exists (
    select 1 from warehouses
    where id = new.warehouse_id and org_id = new.org_id
  ) then
    raise exception 'Warehouse does not belong to this organization';
  end if;

  insert into stock_levels (org_id, product_id, warehouse_id, on_hand, updated_at)
  values (new.org_id, new.product_id, new.warehouse_id, new.quantity, now())
  on conflict (product_id, warehouse_id)
  do update set on_hand = stock_levels.on_hand + new.quantity,
                updated_at = now()
  returning on_hand, reserved into v_on_hand, v_reserved;

  if v_on_hand < 0 then
    raise exception
      'Insufficient stock at this warehouse: on-hand would become %', v_on_hand
      using errcode = 'check_violation';
  end if;

  if v_on_hand < v_reserved then
    raise exception
      'This movement would consume reserved stock (on-hand % < reserved %)',
      v_on_hand, v_reserved
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
