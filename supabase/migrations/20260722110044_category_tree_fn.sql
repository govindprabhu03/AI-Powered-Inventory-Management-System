-- Phase 2: category tree via a recursive CTE.
--
-- categories.parent_id makes the table a tree. To render it, we need each row's
-- DEPTH (for indentation), a PATH (for hierarchical ordering) and a PRODUCT
-- COUNT. A plain SELECT cannot walk a tree of unknown depth; a recursive CTE can.
--
-- This is exposed as a function so the app can call it with one RPC. It runs as
-- SECURITY INVOKER (the default), so RLS still applies inside it — a user only
-- ever sees categories in orgs they belong to. We also filter on p_org_id, and
-- because RLS forbids reading another org's rows, passing a foreign id simply
-- returns nothing.

create or replace function public.category_tree(p_org_id uuid)
returns table (
  id            uuid,
  name          text,
  parent_id     uuid,
  depth         integer,
  path          text,
  product_count bigint
)
language sql
stable
set search_path = public
as $$
  with recursive tree as (
    -- Anchor: the roots (top-level categories have no parent).
    select
      c.id,
      c.name,
      c.parent_id,
      0 as depth,
      c.name as path
    from categories c
    where c.org_id = p_org_id
      and c.parent_id is null

    union all

    -- Recursive step: children of rows already in `tree`. Postgres repeats this
    -- join, feeding each pass's output back in, until it produces no new rows.
    select
      c.id,
      c.name,
      c.parent_id,
      t.depth + 1,
      -- Build a path like "Grocery / Beverages / Soft drinks" so ordering by it
      -- lists each parent immediately before its children.
      t.path || ' / ' || c.name
    from categories c
    join tree t on c.parent_id = t.id
    where c.org_id = p_org_id
  )
  select
    t.id,
    t.name,
    t.parent_id,
    t.depth,
    t.path,
    -- Direct (non-archived) products filed under this category.
    (
      select count(*)
      from products p
      where p.category_id = t.id
        and not p.is_archived
    ) as product_count
  from tree t
  order by t.path;
$$;

comment on function public.category_tree is
  'Returns an org''s categories with depth, path and direct product count, ordered for tree display.';

-- authenticated users may call it; anon may not.
revoke all on function public.category_tree(uuid) from public, anon;
grant execute on function public.category_tree(uuid) to authenticated;
