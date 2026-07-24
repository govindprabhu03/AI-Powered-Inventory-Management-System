-- Phase 5: audit log.
--
-- One generic trigger records every create/update/delete on the key business
-- tables into an immutable audit_log. Because it runs in the database, no code
-- path can skip it and history cannot be edited.

create table public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  actor_id   uuid references auth.users(id) on delete set null,
  table_name text not null,
  record_id  uuid,
  action     text not null check (action in ('insert', 'update', 'delete')),
  -- INSERT/DELETE: the whole row. UPDATE: { old, new }.
  changes    jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_org_idx on public.audit_log (org_id, created_at desc);

alter table public.audit_log enable row level security;

-- Managers review the audit. There is no insert/update/delete policy at all:
-- only the SECURITY DEFINER trigger writes it, and nobody can alter it.
create policy "managers read audit log"
  on public.audit_log for select to authenticated
  using (public.has_org_role(org_id, 'super_admin', 'inventory_manager'));

-- ===========================================================================
-- The generic audit trigger
-- ===========================================================================
--
-- SECURITY DEFINER so it can write audit_log even though users have no insert
-- policy there. It reads TG_OP and TG_TABLE_NAME (set by Postgres for every
-- trigger) to stay table-agnostic. Every audited table has an org_id column,
-- which is where the entry is scoped.

create or replace function public.record_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org    uuid;
  v_action text;
  v_id     uuid;
  v_data   jsonb;
begin
  if tg_op = 'DELETE' then
    v_action := 'delete';
    v_org    := old.org_id;
    v_id     := old.id;
    v_data   := to_jsonb(old);
  elsif tg_op = 'UPDATE' then
    v_action := 'update';
    v_org    := new.org_id;
    v_id     := new.id;
    v_data   := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  else
    v_action := 'insert';
    v_org    := new.org_id;
    v_id     := new.id;
    v_data   := to_jsonb(new);
  end if;

  insert into audit_log (org_id, actor_id, table_name, record_id, action, changes)
  values (v_org, (select auth.uid()), tg_table_name, v_id, v_action, v_data);

  return null; -- AFTER trigger; return value is ignored
end;
$$;

-- Attach to the business tables. Each has org_id and id, which is all the
-- generic function needs. Stock movements are deliberately excluded — the
-- append-only ledger is already its own audit trail.
create trigger audit_products
  after insert or update or delete on public.products
  for each row execute function public.record_audit();

create trigger audit_categories
  after insert or update or delete on public.categories
  for each row execute function public.record_audit();

create trigger audit_suppliers
  after insert or update or delete on public.suppliers
  for each row execute function public.record_audit();

create trigger audit_warehouses
  after insert or update or delete on public.warehouses
  for each row execute function public.record_audit();

create trigger audit_customers
  after insert or update or delete on public.customers
  for each row execute function public.record_audit();

create trigger audit_purchase_orders
  after insert or update or delete on public.purchase_orders
  for each row execute function public.record_audit();

create trigger audit_sales_orders
  after insert or update or delete on public.sales_orders
  for each row execute function public.record_audit();

create trigger audit_organization_members
  after insert or update or delete on public.organization_members
  for each row execute function public.record_audit();
