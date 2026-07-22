-- Phase 2: product images via Supabase Storage.
--
-- Two parts:
--   1. product_images — a normal table linking a product to a stored file.
--   2. a private Storage bucket, with RLS on storage.objects so files are
--      scoped to an organization exactly like every other table.
--
-- Path convention for every uploaded file:  {org_id}/{product_id}/{uuid.ext}
-- The FIRST path segment is the org id, and that is what the storage policies
-- check — so a file is only reachable by members of the org that owns it.

-- ---------------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------------

create table public.product_images (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  -- The object key within the bucket, e.g. "<org>/<product>/<uuid>.jpg".
  storage_path text not null,
  -- Exactly one image per product is the primary (shown in lists). Enforced by
  -- the partial unique index below.
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index product_images_product_id_idx on public.product_images (product_id);

-- At most one primary image per product.
create unique index product_images_one_primary_idx
  on public.product_images (product_id)
  where is_primary;

alter table public.product_images enable row level security;

create policy "members read product images"
  on public.product_images for select to authenticated
  using (org_id in (select public.user_org_ids()));

create policy "managers write product images"
  on public.product_images for all to authenticated
  using (public.has_org_role(org_id, 'super_admin', 'inventory_manager'))
  with check (public.has_org_role(org_id, 'super_admin', 'inventory_manager'));

-- ---------------------------------------------------------------------------
-- Storage bucket
-- ---------------------------------------------------------------------------
--
-- Private (public = false): files are never served by a plain URL; the app
-- generates short-lived signed URLs for display. The size and mime limits are
-- enforced by Storage itself, so even a direct upload cannot bypass them.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  false,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Storage RLS (policies live on storage.objects)
-- ---------------------------------------------------------------------------
--
-- We match on the path prefix rather than casting the first folder to uuid,
-- which avoids errors on any unexpected path shape. `name` is the full object
-- key; `m.org_id::text || '/%'` matches keys that begin with an org the user
-- belongs to.
--
-- Reading is open to any member; writing (upload/delete) is limited to
-- managers, mirroring the catalog write policies.

create policy "members read their org's product images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.organization_members m
      where m.user_id = (select auth.uid())
        and name like m.org_id::text || '/%'
    )
  );

create policy "managers upload product images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.organization_members m
      where m.user_id = (select auth.uid())
        and m.role in ('super_admin', 'inventory_manager')
        and name like m.org_id::text || '/%'
    )
  );

create policy "managers delete product images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.organization_members m
      where m.user_id = (select auth.uid())
        and m.role in ('super_admin', 'inventory_manager')
        and name like m.org_id::text || '/%'
    )
  );
