-- Phase 4: order workflow — the only way order state ever changes.
--
-- Each function below is one legal transition of the state machine. They are
-- SECURITY DEFINER because the order tables and stock_levels have no client
-- write policies at all; since definer bypasses RLS, every function does its
-- own explicit role check with has_org_role() before touching anything.
--
-- Concurrency: each transition starts by locking the order row
-- (SELECT ... FOR UPDATE), so two simultaneous "approve" clicks serialise and
-- the second one sees the already-changed status and fails cleanly.

-- ===========================================================================
-- Purchase orders
-- ===========================================================================

create or replace function public.create_purchase_order(
  p_supplier_id   uuid,
  p_warehouse_id  uuid,
  p_items         jsonb,
  p_notes         text default null,
  p_expected_date date default null
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org  uuid;
  v_seq  integer;
  v_po   purchase_orders;
  v_item jsonb;
  v_pid  uuid;
  v_qty  integer;
  v_cost numeric;
begin
  select org_id into v_org from suppliers where id = p_supplier_id;
  if v_org is null then
    raise exception 'Supplier not found';
  end if;
  if not has_org_role(v_org, 'super_admin', 'inventory_manager') then
    raise exception 'You do not have permission to create purchase orders';
  end if;
  if not exists (select 1 from warehouses where id = p_warehouse_id and org_id = v_org) then
    raise exception 'Warehouse not found in this organization';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A purchase order needs at least one item';
  end if;

  -- Atomic per-org sequence: the row update locks, so numbers never collide.
  update organizations set po_seq = po_seq + 1 where id = v_org
  returning po_seq into v_seq;

  insert into purchase_orders (org_id, order_number, supplier_id, warehouse_id, notes, expected_date)
  values (v_org, 'PO-' || lpad(v_seq::text, 4, '0'), p_supplier_id, p_warehouse_id, p_notes, p_expected_date)
  returning * into v_po;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid  := (v_item ->> 'product_id')::uuid;
    v_qty  := (v_item ->> 'quantity')::integer;
    v_cost := coalesce((v_item ->> 'unit_cost')::numeric, 0);

    if v_qty is null or v_qty <= 0 then
      raise exception 'Item quantity must be a positive whole number';
    end if;
    if v_cost < 0 then
      raise exception 'Unit cost cannot be negative';
    end if;
    if not exists (select 1 from products where id = v_pid and org_id = v_org) then
      raise exception 'Product not found in this organization';
    end if;

    insert into purchase_order_items (org_id, purchase_order_id, product_id, quantity, unit_cost)
    values (v_org, v_po.id, v_pid, v_qty, v_cost);
  end loop;

  return v_po;
end;
$$;

create or replace function public.submit_purchase_order(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po purchase_orders;
begin
  select * into v_po from purchase_orders where id = p_id for update;
  if v_po.id is null then raise exception 'Purchase order not found'; end if;
  if not has_org_role(v_po.org_id, 'super_admin', 'inventory_manager') then
    raise exception 'You do not have permission to submit purchase orders';
  end if;
  if v_po.status <> 'draft' then
    raise exception 'Only a draft can be submitted (current status: %)', v_po.status;
  end if;

  update purchase_orders set status = 'pending_approval' where id = p_id;
end;
$$;

create or replace function public.approve_purchase_order(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po purchase_orders;
begin
  select * into v_po from purchase_orders where id = p_id for update;
  if v_po.id is null then raise exception 'Purchase order not found'; end if;
  -- Approval is deliberately the narrowest permission: super admins only.
  if not has_org_role(v_po.org_id, 'super_admin') then
    raise exception 'Only a super admin can approve purchase orders';
  end if;
  if v_po.status <> 'pending_approval' then
    raise exception 'Only a pending order can be approved (current status: %)', v_po.status;
  end if;

  update purchase_orders
  set status = 'approved', approved_by = auth.uid(), approved_at = now()
  where id = p_id;
end;
$$;

create or replace function public.receive_purchase_order(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po   purchase_orders;
  v_item record;
begin
  select * into v_po from purchase_orders where id = p_id for update;
  if v_po.id is null then raise exception 'Purchase order not found'; end if;
  if not has_org_role(v_po.org_id, 'super_admin', 'inventory_manager', 'warehouse_staff') then
    raise exception 'You do not have permission to receive purchase orders';
  end if;
  if v_po.status <> 'approved' then
    raise exception 'Only an approved order can be received (current status: %)', v_po.status;
  end if;

  -- Receiving IS a set of ledger entries — one stock_in per line, tagged with
  -- the order number. The stock trigger maintains levels as always.
  for v_item in
    select product_id, quantity from purchase_order_items
    where purchase_order_id = p_id
  loop
    insert into stock_movements (org_id, product_id, warehouse_id, movement_type, quantity, reference)
    values (v_po.org_id, v_item.product_id, v_po.warehouse_id, 'stock_in', v_item.quantity, v_po.order_number);
  end loop;

  update purchase_orders set status = 'received', received_at = now() where id = p_id;
end;
$$;

create or replace function public.cancel_purchase_order(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po purchase_orders;
begin
  select * into v_po from purchase_orders where id = p_id for update;
  if v_po.id is null then raise exception 'Purchase order not found'; end if;
  if not has_org_role(v_po.org_id, 'super_admin', 'inventory_manager') then
    raise exception 'You do not have permission to cancel purchase orders';
  end if;
  if v_po.status not in ('draft', 'pending_approval', 'approved') then
    raise exception 'A % order cannot be cancelled', v_po.status;
  end if;

  update purchase_orders set status = 'cancelled' where id = p_id;
end;
$$;

-- ===========================================================================
-- Sales orders
-- ===========================================================================

create or replace function public.create_sales_order(
  p_customer_id  uuid,
  p_warehouse_id uuid,
  p_items        jsonb,
  p_notes        text default null
)
returns public.sales_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org   uuid;
  v_seq   integer;
  v_so    sales_orders;
  v_item  jsonb;
  v_pid   uuid;
  v_qty   integer;
  v_price numeric;
begin
  select org_id into v_org from customers where id = p_customer_id;
  if v_org is null then
    raise exception 'Customer not found';
  end if;
  if not has_org_role(v_org, 'super_admin', 'inventory_manager', 'sales_executive') then
    raise exception 'You do not have permission to create sales orders';
  end if;
  if not exists (select 1 from warehouses where id = p_warehouse_id and org_id = v_org) then
    raise exception 'Warehouse not found in this organization';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A sales order needs at least one item';
  end if;

  update organizations set so_seq = so_seq + 1 where id = v_org
  returning so_seq into v_seq;

  insert into sales_orders (org_id, order_number, customer_id, warehouse_id, notes)
  values (v_org, 'SO-' || lpad(v_seq::text, 4, '0'), p_customer_id, p_warehouse_id, p_notes)
  returning * into v_so;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid   := (v_item ->> 'product_id')::uuid;
    v_qty   := (v_item ->> 'quantity')::integer;
    v_price := coalesce((v_item ->> 'unit_price')::numeric, 0);

    if v_qty is null or v_qty <= 0 then
      raise exception 'Item quantity must be a positive whole number';
    end if;
    if v_price < 0 then
      raise exception 'Unit price cannot be negative';
    end if;
    if not exists (select 1 from products where id = v_pid and org_id = v_org) then
      raise exception 'Product not found in this organization';
    end if;

    insert into sales_order_items (org_id, sales_order_id, product_id, quantity, unit_price)
    values (v_org, v_so.id, v_pid, v_qty, v_price);
  end loop;

  return v_so;
end;
$$;

create or replace function public.confirm_sales_order(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_so       sales_orders;
  v_item     record;
  v_on_hand  integer;
  v_reserved integer;
begin
  select * into v_so from sales_orders where id = p_id for update;
  if v_so.id is null then raise exception 'Sales order not found'; end if;
  if not has_org_role(v_so.org_id, 'super_admin', 'inventory_manager', 'sales_executive') then
    raise exception 'You do not have permission to confirm sales orders';
  end if;
  if v_so.status <> 'draft' then
    raise exception 'Only a draft can be confirmed (current status: %)', v_so.status;
  end if;

  -- Reserve each line. The FOR UPDATE lock serialises against every other
  -- confirmation, so two orders cannot both grab the last units.
  for v_item in
    select i.product_id, i.quantity, p.name
    from sales_order_items i
    join products p on p.id = i.product_id
    where i.sales_order_id = p_id
  loop
    select on_hand, reserved into v_on_hand, v_reserved
    from stock_levels
    where product_id = v_item.product_id and warehouse_id = v_so.warehouse_id
    for update;

    if v_on_hand is null or (v_on_hand - v_reserved) < v_item.quantity then
      raise exception
        'Insufficient available stock of % (need %, available %)',
        v_item.name, v_item.quantity, coalesce(v_on_hand - v_reserved, 0)
        using errcode = 'check_violation';
    end if;

    update stock_levels
    set reserved = reserved + v_item.quantity
    where product_id = v_item.product_id and warehouse_id = v_so.warehouse_id;
  end loop;

  update sales_orders set status = 'confirmed', confirmed_at = now() where id = p_id;
end;
$$;

create or replace function public.fulfil_sales_order(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_so   sales_orders;
  v_item record;
begin
  select * into v_so from sales_orders where id = p_id for update;
  if v_so.id is null then raise exception 'Sales order not found'; end if;
  if not has_org_role(v_so.org_id, 'super_admin', 'inventory_manager', 'warehouse_staff') then
    raise exception 'You do not have permission to fulfil sales orders';
  end if;
  if v_so.status <> 'confirmed' then
    raise exception 'Only a confirmed order can be fulfilled (current status: %)', v_so.status;
  end if;

  -- Release the reservation FIRST, then post the outgoing movement, inside
  -- this one transaction. The trigger's on_hand >= reserved check then passes
  -- exactly when it should: fulfilment spends the units it reserved.
  for v_item in
    select product_id, quantity from sales_order_items
    where sales_order_id = p_id
  loop
    update stock_levels
    set reserved = reserved - v_item.quantity
    where product_id = v_item.product_id
      and warehouse_id = v_so.warehouse_id
      and reserved >= v_item.quantity;

    if not found then
      raise exception 'Reservation record is inconsistent; cannot fulfil';
    end if;

    insert into stock_movements (org_id, product_id, warehouse_id, movement_type, quantity, reference)
    values (v_so.org_id, v_item.product_id, v_so.warehouse_id, 'stock_out', -v_item.quantity, v_so.order_number);
  end loop;

  update sales_orders set status = 'fulfilled', fulfilled_at = now() where id = p_id;
end;
$$;

create or replace function public.cancel_sales_order(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_so   sales_orders;
  v_item record;
begin
  select * into v_so from sales_orders where id = p_id for update;
  if v_so.id is null then raise exception 'Sales order not found'; end if;
  if not has_org_role(v_so.org_id, 'super_admin', 'inventory_manager', 'sales_executive') then
    raise exception 'You do not have permission to cancel sales orders';
  end if;
  if v_so.status not in ('draft', 'confirmed') then
    raise exception 'A % order cannot be cancelled', v_so.status;
  end if;

  -- A confirmed order holds reservations; cancelling releases them.
  if v_so.status = 'confirmed' then
    for v_item in
      select product_id, quantity from sales_order_items
      where sales_order_id = p_id
    loop
      update stock_levels
      set reserved = greatest(reserved - v_item.quantity, 0)
      where product_id = v_item.product_id and warehouse_id = v_so.warehouse_id;
    end loop;
  end if;

  update sales_orders set status = 'cancelled' where id = p_id;
end;
$$;

-- Return part (or all) of a fulfilled order back into stock. Guards against
-- over-returning by counting what has already come back for this order.
create or replace function public.return_sales_order_items(
  p_id    uuid,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_so       sales_orders;
  v_item     jsonb;
  v_pid      uuid;
  v_qty      integer;
  v_sold     integer;
  v_returned integer;
begin
  select * into v_so from sales_orders where id = p_id for update;
  if v_so.id is null then raise exception 'Sales order not found'; end if;
  if not has_org_role(v_so.org_id, 'super_admin', 'inventory_manager', 'warehouse_staff') then
    raise exception 'You do not have permission to record returns';
  end if;
  if v_so.status <> 'fulfilled' then
    raise exception 'Returns are only possible on a fulfilled order (current status: %)', v_so.status;
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Specify at least one item to return';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pid := (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'quantity')::integer;

    if v_qty is null or v_qty <= 0 then
      raise exception 'Return quantity must be a positive whole number';
    end if;

    select quantity into v_sold from sales_order_items
    where sales_order_id = p_id and product_id = v_pid;
    if v_sold is null then
      raise exception 'That product is not on this order';
    end if;

    select coalesce(sum(quantity), 0) into v_returned
    from stock_movements
    where org_id = v_so.org_id
      and product_id = v_pid
      and movement_type = 'return'
      and reference = v_so.order_number;

    if v_returned + v_qty > v_sold then
      raise exception
        'Cannot return % of this product: % sold, % already returned',
        v_qty, v_sold, v_returned;
    end if;

    insert into stock_movements (org_id, product_id, warehouse_id, movement_type, quantity, reference)
    values (v_so.org_id, v_pid, v_so.warehouse_id, 'return', v_qty, v_so.order_number);
  end loop;
end;
$$;

-- ===========================================================================
-- Payment status
-- ===========================================================================

create or replace function public.set_purchase_payment_status(
  p_id uuid, p_status public.payment_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select org_id into v_org from purchase_orders where id = p_id for update;
  if v_org is null then raise exception 'Purchase order not found'; end if;
  if not has_org_role(v_org, 'super_admin', 'inventory_manager') then
    raise exception 'You do not have permission to update payment status';
  end if;
  update purchase_orders set payment_status = p_status where id = p_id;
end;
$$;

create or replace function public.set_sales_payment_status(
  p_id uuid, p_status public.payment_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select org_id into v_org from sales_orders where id = p_id for update;
  if v_org is null then raise exception 'Sales order not found'; end if;
  if not has_org_role(v_org, 'super_admin', 'inventory_manager', 'sales_executive') then
    raise exception 'You do not have permission to update payment status';
  end if;
  update sales_orders set payment_status = p_status where id = p_id;
end;
$$;

-- ===========================================================================
-- Grants
-- ===========================================================================

revoke all on function public.create_purchase_order(uuid, uuid, jsonb, text, date) from public, anon;
revoke all on function public.submit_purchase_order(uuid)  from public, anon;
revoke all on function public.approve_purchase_order(uuid) from public, anon;
revoke all on function public.receive_purchase_order(uuid) from public, anon;
revoke all on function public.cancel_purchase_order(uuid)  from public, anon;
revoke all on function public.create_sales_order(uuid, uuid, jsonb, text) from public, anon;
revoke all on function public.confirm_sales_order(uuid) from public, anon;
revoke all on function public.fulfil_sales_order(uuid)  from public, anon;
revoke all on function public.cancel_sales_order(uuid)  from public, anon;
revoke all on function public.return_sales_order_items(uuid, jsonb) from public, anon;
revoke all on function public.set_purchase_payment_status(uuid, public.payment_status) from public, anon;
revoke all on function public.set_sales_payment_status(uuid, public.payment_status)    from public, anon;

grant execute on function public.create_purchase_order(uuid, uuid, jsonb, text, date) to authenticated;
grant execute on function public.submit_purchase_order(uuid)  to authenticated;
grant execute on function public.approve_purchase_order(uuid) to authenticated;
grant execute on function public.receive_purchase_order(uuid) to authenticated;
grant execute on function public.cancel_purchase_order(uuid)  to authenticated;
grant execute on function public.create_sales_order(uuid, uuid, jsonb, text) to authenticated;
grant execute on function public.confirm_sales_order(uuid) to authenticated;
grant execute on function public.fulfil_sales_order(uuid)  to authenticated;
grant execute on function public.cancel_sales_order(uuid)  to authenticated;
grant execute on function public.return_sales_order_items(uuid, jsonb) to authenticated;
grant execute on function public.set_purchase_payment_status(uuid, public.payment_status) to authenticated;
grant execute on function public.set_sales_payment_status(uuid, public.payment_status)    to authenticated;
