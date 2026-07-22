-- Phase 3: the inventory ledger.
--
-- The central design decision of the whole system: stock is an APPEND-ONLY
-- LEDGER, not a mutable number.
--
--   stock_movements — one immutable row per change (in/out/transfer/damage/...).
--                     Never updated, never deleted. This is the source of truth.
--   stock_levels    — a derived cache of on-hand quantity per product x
--                     warehouse, maintained automatically by a trigger so it can
--                     never drift from the ledger.
--
-- Why not just a stock_quantity column on products?
--   * it loses all history (audit, forecasting need it)
--   * "UPDATE ... SET stock = stock - 1" corrupts under two concurrent orders
--     (the lost-update problem)
--   * it can't represent the same product held in several warehouses

-- ===========================================================================
-- Movement types
-- ===========================================================================

create type public.movement_type as enum (
  'stock_in',      -- receiving / initial stock (increases)
  'stock_out',     -- sale / consumption (decreases)
  'transfer_in',   -- arriving from another warehouse (increases)
  'transfer_out',  -- leaving to another warehouse (decreases)
  'return',        -- customer return back into stock (increases)
  'damage',        -- written off as damaged (decreases)
  'loss',          -- shrinkage / lost (decreases)
  'adjustment'     -- manual correction (either direction)
);

-- ===========================================================================
-- stock_movements — the append-only ledger
-- ===========================================================================

create table public.stock_movements (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,

  -- ON DELETE RESTRICT: a product or warehouse with any movement history cannot
  -- be hard-deleted. This is the FK the Phase 2 product delete referred to — it
  -- steers users toward archiving instead of destroying history.
  product_id    uuid not null references public.products(id)   on delete restrict,
  warehouse_id  uuid not null references public.warehouses(id) on delete restrict,

  movement_type public.movement_type not null,

  -- SIGNED delta applied to on-hand stock. Positive increases, negative
  -- decreases. The sign carries the direction so the trigger is a simple sum;
  -- movement_type is the human-readable category. Zero is meaningless.
  quantity      integer not null check (quantity <> 0),

  note          text,
  -- Free-form link to a source document (a PO/SO number, etc.) — used later.
  reference     text,

  -- Who posted it, defaulted from the JWT so callers never have to pass it.
  created_by    uuid not null default auth.uid(),
  created_at    timestamptz not null default now()
);

create index stock_movements_org_id_idx      on public.stock_movements (org_id);
create index stock_movements_product_wh_idx  on public.stock_movements (product_id, warehouse_id);
create index stock_movements_created_at_idx  on public.stock_movements (created_at desc);

-- ===========================================================================
-- stock_levels — the derived cache
-- ===========================================================================

create table public.stock_levels (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  product_id   uuid not null references public.products(id)   on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,

  -- Maintained by the trigger below. Never written directly by application code.
  on_hand      integer not null default 0,
  -- Reserved against unfulfilled sales orders. Populated in Phase 4; 0 for now.
  reserved     integer not null default 0 check (reserved >= 0),
  -- available = what can actually be sold right now. A STORED generated column,
  -- so it is always consistent and can be indexed/queried like a normal column.
  available    integer generated always as (on_hand - reserved) stored,

  updated_at   timestamptz not null default now(),

  unique (product_id, warehouse_id)
);

create index stock_levels_org_id_idx     on public.stock_levels (org_id);
create index stock_levels_product_id_idx on public.stock_levels (product_id);

-- ===========================================================================
-- The trigger that keeps stock_levels in step with the ledger
-- ===========================================================================
--
-- SECURITY DEFINER on purpose: application users have NO write policy on
-- stock_levels (see RLS below), so only this trigger — running as the owner —
-- may modify it. That is what guarantees the cache can only change as a
-- consequence of a real ledger entry.
--
-- It also validates that the product and warehouse belong to the movement's
-- org (defence in depth against a forged org_id), and enforces the invariant
-- that on-hand can never go negative. Raising here rolls back the whole
-- transaction — the movement insert and the level update together — so the
-- ledger and the cache can never disagree.

create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_on_hand integer;
begin
  -- Cross-org consistency: product and warehouse must be in the same org as
  -- the movement.
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

  -- Apply the delta. ON CONFLICT locks the existing row, so two concurrent
  -- movements for the same product/warehouse serialise here rather than losing
  -- an update.
  insert into stock_levels (org_id, product_id, warehouse_id, on_hand, updated_at)
  values (new.org_id, new.product_id, new.warehouse_id, new.quantity, now())
  on conflict (product_id, warehouse_id)
  do update set on_hand = stock_levels.on_hand + new.quantity,
                updated_at = now()
  returning on_hand into v_on_hand;

  if v_on_hand < 0 then
    raise exception
      'Insufficient stock at this warehouse: on-hand would become %', v_on_hand
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger on_stock_movement
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- keep stock_levels.updated_at fresh on the reserved-quantity updates too
create trigger stock_levels_set_updated_at
  before update on public.stock_levels
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Atomic warehouse transfer
-- ===========================================================================
--
-- A transfer is two movements — out of the source, into the destination — that
-- must both succeed or both fail. Doing them as one function call makes them a
-- single transaction. If the source lacks stock, the non-negative check above
-- fires and BOTH inserts roll back.
--
-- SECURITY INVOKER (the default): it runs as the caller, so RLS on
-- stock_movements decides whether they may post movements at all.

create or replace function public.record_stock_transfer(
  p_product_id     uuid,
  p_from_warehouse uuid,
  p_to_warehouse   uuid,
  p_quantity       integer,
  p_note           text default null
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_org uuid;
begin
  if p_quantity <= 0 then
    raise exception 'Transfer quantity must be positive';
  end if;
  if p_from_warehouse = p_to_warehouse then
    raise exception 'Source and destination must differ';
  end if;

  -- RLS restricts this SELECT to the caller's orgs, so v_org is only set for a
  -- product they can actually see.
  select org_id into v_org from products where id = p_product_id;
  if v_org is null then
    raise exception 'Product not found';
  end if;

  if not exists (select 1 from warehouses where id = p_from_warehouse and org_id = v_org) then
    raise exception 'Source warehouse not found';
  end if;
  if not exists (select 1 from warehouses where id = p_to_warehouse and org_id = v_org) then
    raise exception 'Destination warehouse not found';
  end if;

  insert into stock_movements (org_id, product_id, warehouse_id, movement_type, quantity, note)
  values (v_org, p_product_id, p_from_warehouse, 'transfer_out', -p_quantity, p_note);

  insert into stock_movements (org_id, product_id, warehouse_id, movement_type, quantity, note)
  values (v_org, p_product_id, p_to_warehouse, 'transfer_in', p_quantity, p_note);
end;
$$;

revoke all on function public.record_stock_transfer(uuid, uuid, uuid, integer, text) from public, anon;
grant execute on function public.record_stock_transfer(uuid, uuid, uuid, integer, text) to authenticated;

-- ===========================================================================
-- Row Level Security
-- ===========================================================================

alter table public.stock_movements enable row level security;
alter table public.stock_levels    enable row level security;

-- stock_movements: members read; staff-and-up may POST movements. There is
-- deliberately NO update and NO delete policy — the ledger is append-only.
-- Corrections are made by posting an 'adjustment', never by editing history.
create policy "members read stock movements"
  on public.stock_movements for select to authenticated
  using (org_id in (select public.user_org_ids()));

create policy "staff record stock movements"
  on public.stock_movements for insert to authenticated
  with check (
    public.has_org_role(org_id, 'super_admin', 'inventory_manager', 'warehouse_staff')
  );

-- stock_levels: members read only. No write policies at all — the SECURITY
-- DEFINER trigger is the only thing permitted to change it.
create policy "members read stock levels"
  on public.stock_levels for select to authenticated
  using (org_id in (select public.user_org_ids()));
