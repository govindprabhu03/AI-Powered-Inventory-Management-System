-- Phase 5: notifications, driven by the database.
--
-- Notifications are fanned out to specific users (one row per recipient), so
-- read state is naturally per-user. A low-stock condition is detected by a
-- trigger on stock_levels — the app never polls; the rule lives with the data.

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,          -- 'low_stock', extensible
  title      text not null,
  body       text,
  link       text,                   -- where clicking it takes you
  entity_id  uuid,                   -- the subject (product id), for de-duplication
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

-- Unread-first, newest-first is how the bell reads them.
create index notifications_user_idx
  on public.notifications (user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

-- A user only ever sees, marks, or dismisses their OWN notifications. There is
-- no insert policy — only the SECURITY DEFINER trigger creates them.
create policy "users read their notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy "users update their notifications"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "users delete their notifications"
  on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- ===========================================================================
-- Low-stock detection
-- ===========================================================================
--
-- Fires whenever a product's on-hand or reserved changes. It sums AVAILABLE
-- across all warehouses (the low_stock report uses the same total), and if that
-- is at or below the reorder level, fans out a notification to the managers who
-- would act on it. A de-dup guard means it won't re-notify while the product is
-- already flagged unread — you get one alert per dip, not one per movement.

create or replace function public.check_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reorder integer;
  v_org     uuid;
  v_name    text;
  v_total   integer;
begin
  select reorder_level, org_id, name
    into v_reorder, v_org, v_name
  from products
  where id = new.product_id;

  if v_reorder is null or v_reorder <= 0 then
    return new;
  end if;

  select coalesce(sum(available), 0)
    into v_total
  from stock_levels
  where product_id = new.product_id;

  if v_total <= v_reorder then
    -- Only alert if there isn't already an unread low-stock notice for it.
    if not exists (
      select 1 from notifications
      where entity_id = new.product_id
        and type = 'low_stock'
        and not is_read
    ) then
      insert into notifications (org_id, user_id, type, title, body, link, entity_id)
      select
        v_org,
        m.user_id,
        'low_stock',
        'Low stock: ' || v_name,
        v_name || ' is at or below its reorder level (' || v_total || ' available).',
        '/stock/history/' || new.product_id,
        new.product_id
      from organization_members m
      where m.org_id = v_org
        and m.role in ('super_admin', 'inventory_manager');
    end if;
  end if;

  return new;
end;
$$;

create trigger on_stock_level_change
  after insert or update of on_hand, reserved on public.stock_levels
  for each row execute function public.check_low_stock();

-- Broadcast notifications over Realtime so the bell updates live. RLS still
-- applies per subscriber, so a user only receives their own.
alter publication supabase_realtime add table public.notifications;
