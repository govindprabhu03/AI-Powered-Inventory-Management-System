-- Phase 0 smoke test.
--
-- Purpose: prove the whole chain works end to end —
--   migration file in git -> applied to Supabase -> read by a Server Component
--   -> rendered locally -> rendered on Vercel.
--
-- This table is intentionally throwaway and gets dropped in Phase 1, once the
-- real schema (profiles, organizations, products...) lands. It also serves as a
-- gentle first look at Row Level Security before Phase 1 goes deep on it.

create table public.health_check (
  id          uuid primary key default gen_random_uuid(),
  message     text        not null,
  checked_at  timestamptz not null default now()
);

-- Row Level Security is OFF by default on a new table, which would mean anyone
-- holding the publishable key could read AND write this table. Enabling it
-- flips the default to "deny everything"; access is then granted back only by
-- explicit policies.
--
-- Get in the habit now: every table we create gets this line.
alter table public.health_check enable row level security;

-- Grant back exactly one thing: read access.
-- `for select` = reads only, so nobody can insert, update or delete.
-- `using (true)` = no row-level restriction; every row is visible.
--
-- Safe here because the table holds nothing sensitive. Real tables in Phase 1
-- use `using (org_id = ...)` so each organization sees only its own rows.
create policy "health_check is publicly readable"
  on public.health_check
  for select
  to anon, authenticated
  using (true);

insert into public.health_check (message)
values ('Supabase is connected to Next.js.');
