-- Phase 1: authentication and organization schema.
--
-- This migration defines the SHAPE of the data. The next migration defines WHO
-- CAN SEE IT (Row Level Security). They are split so each can be read on its own.
--
-- Supabase already gives us `auth.users`, which stores emails, hashed passwords
-- and OAuth identities. That table is managed by Supabase and we must not alter
-- it. Everything below either extends it or references it.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

-- An enum instead of a text column: Postgres rejects any value not in this list,
-- so a typo like 'inventory_mananger' fails at write time rather than silently
-- creating a role that grants nothing.
create type public.org_role as enum (
  'super_admin',        -- full control, including billing and deleting the org
  'inventory_manager',  -- manage products, stock, purchase orders
  'warehouse_staff',    -- record stock movements, run transfers
  'sales_executive',    -- create sales orders and manage customers
  'supplier'            -- external partner with heavily limited read access
);

-- ---------------------------------------------------------------------------
-- profiles — public user data
-- ---------------------------------------------------------------------------

-- Why a separate table at all? `auth.users` is Supabase's private table; we
-- should not add columns to it, and we do not want to expose it (it holds
-- password hashes and tokens). `profiles` is the public-facing half.
--
-- Note `id` is BOTH the primary key AND a foreign key to auth.users. That makes
-- it strictly 1-to-1: a profile cannot exist without a user, and there can never
-- be two profiles for one user. `on delete cascade` means deleting the auth user
-- removes the profile automatically.
create table public.profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  full_name              text,
  avatar_url             text,
  phone                  text,
  -- Notification preferences from Module 1. jsonb rather than three columns so
  -- adding a channel later doesn't require a migration.
  notification_prefs     jsonb not null default '{"email": true, "in_app": true, "push": false}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.profiles is 'Public profile data, one row per auth.users row.';

-- ---------------------------------------------------------------------------
-- organizations — the tenant boundary
-- ---------------------------------------------------------------------------

-- This is the most important table in the system. Every business table we add
-- from Phase 2 onward carries an `org_id` pointing here, and every RLS policy
-- filters on it. It is what makes the app multi-tenant.
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  -- URL-safe identifier, e.g. /acme-traders/products. Unique across the whole
  -- platform because it appears in URLs.
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Denormalised for convenience; the authoritative role list is in
  -- organization_members. `on delete restrict` stops a user being deleted while
  -- they still own organizations, which would orphan the data.
  created_by  uuid not null references auth.users(id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.organizations is 'A tenant. All business data is scoped to one of these.';

-- ---------------------------------------------------------------------------
-- organization_members — who belongs to which org, and as what
-- ---------------------------------------------------------------------------

-- A join table implementing many-to-many: one user can belong to several
-- organizations (a consultant serving two clients), and one organization has
-- many users. The `role` lives on the membership, not on the user, because the
-- same person can be an admin in one org and warehouse staff in another.
create table public.organization_members (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.org_role not null default 'warehouse_staff',
  created_at timestamptz not null default now(),

  -- A user can hold at most one role per organization. Without this you could
  -- insert the same person twice with conflicting roles and permission checks
  -- would become ambiguous.
  unique (org_id, user_id)
);

comment on table public.organization_members is 'Membership and role of a user within an organization.';

-- Indexes matter because every RLS policy in the system queries this table.
-- Without them, each policy check would scan every membership row.
create index organization_members_user_id_idx on public.organization_members (user_id);
create index organization_members_org_id_idx  on public.organization_members (org_id);

-- ---------------------------------------------------------------------------
-- invitations — pending invites to join an org
-- ---------------------------------------------------------------------------

-- Invites are addressed to an EMAIL, not a user id, because the invitee may not
-- have signed up yet. On acceptance we look them up by email and create the
-- membership row.
create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  email       text not null check (position('@' in email) > 1),
  role        public.org_role not null default 'warehouse_staff',
  -- A random unguessable token, emailed as a link. uuid rather than a sequential
  -- id so nobody can enumerate invitations and join organizations uninvited.
  token       uuid not null default gen_random_uuid() unique,
  invited_by  uuid not null references auth.users(id) on delete cascade,
  -- Invites expire. An old inbox should not be a permanent way in.
  expires_at  timestamptz not null default (now() + interval '7 days'),
  -- Null until accepted; doubles as "has this been used?"
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),

  -- One outstanding invite per email per org; re-inviting updates the existing row.
  unique (org_id, email)
);

comment on table public.invitations is 'Pending invitations to join an organization.';

create index invitations_email_idx on public.invitations (lower(email));

-- ---------------------------------------------------------------------------
-- Trigger: keep updated_at honest
-- ---------------------------------------------------------------------------

-- Doing this in the database rather than in application code means it is correct
-- no matter what writes the row — our app, a CSV import, or manual SQL.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Trigger: create a profile automatically on signup
-- ---------------------------------------------------------------------------

-- Supabase inserts into auth.users when someone signs up — including via Google
-- or GitHub OAuth, where our application code never runs. If we created profiles
-- from the app instead, OAuth users would end up with no profile row.
--
-- `security definer` is required: this function is triggered by the auth system,
-- which has no rights on public.profiles. Running as the function owner gives it
-- the necessary permission.
--
-- `set search_path = ''` is a security measure. Without it, someone able to
-- create objects could shadow `profiles` with their own table and hijack a
-- function running with elevated privileges. Fully-qualified names below.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    -- OAuth providers supply metadata under different keys; fall back through
    -- the common ones, then to the email local-part.
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  -- If a profile somehow already exists, do nothing rather than failing the
  -- signup. A failed trigger here would block account creation entirely.
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
