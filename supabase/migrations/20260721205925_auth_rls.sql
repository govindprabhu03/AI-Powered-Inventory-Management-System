-- Phase 1: Row Level Security.
--
-- The previous migration defined the shape of the data. This one defines who
-- can see and change it — and it is the single most important file in the
-- project. If these policies are wrong, one business can read another's data,
-- and no amount of careful application code will save us.
--
-- Mental model: enabling RLS on a table means "deny everything". Policies then
-- grant specific access back. A query that matches no policy returns zero rows
-- rather than an error, which is why RLS bugs are quiet and must be tested by
-- actively attacking them.

-- ===========================================================================
-- PART 1 — helper functions
-- ===========================================================================
--
-- THE RECURSION TRAP
--
-- The obvious policy for organization_members is:
--
--   using (org_id in (select org_id from organization_members
--                     where user_id = auth.uid()))
--
-- That looks correct and fails immediately with:
--   "infinite recursion detected in policy for relation organization_members"
--
-- To decide whether you may read a row of organization_members, Postgres has to
-- run the policy, which queries organization_members, which runs the policy...
--
-- The fix is `security definer`. Such a function executes with the privileges of
-- its OWNER (postgres) rather than the caller, and the owner is not subject to
-- RLS — so the inner query runs without triggering policies. Recursion broken.
--
-- Two safety requirements whenever you use security definer:
--   * `set search_path = ''` and fully-qualify every name, so nobody can shadow
--     a table with their own and hijack the elevated privileges.
--   * keep the body as narrow as possible — this is privileged code.
--
-- `stable` tells Postgres the result cannot change within a single statement,
-- so it evaluates the function once per query instead of once per row. On a
-- 10,000-row table that is the difference between fast and unusable.

-- Every organization the current user belongs to.
create or replace function public.user_org_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select m.org_id
  from public.organization_members m
  where m.user_id = (select auth.uid());
$$;

comment on function public.user_org_ids is
  'Org ids the current user belongs to. SECURITY DEFINER to avoid RLS recursion.';

-- The current user's role in one organization, or null if not a member.
create or replace function public.user_role_in(p_org_id uuid)
returns public.org_role
language sql
security definer
stable
set search_path = ''
as $$
  select m.role
  from public.organization_members m
  where m.user_id = (select auth.uid())
    and m.org_id = p_org_id;
$$;

-- Does the current user hold any of the given roles in this organization?
-- `variadic` lets us write: public.has_org_role(org_id, 'super_admin', 'inventory_manager')
create or replace function public.has_org_role(
  p_org_id uuid,
  variadic p_roles public.org_role[]
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.user_id = (select auth.uid())
      and m.org_id = p_org_id
      and m.role = any(p_roles)
  );
$$;

-- May the current user see this profile? True for their own profile, and for
-- anyone sharing an organization with them.
create or replace function public.can_see_profile(p_profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    p_profile_id = (select auth.uid())
    or exists (
      select 1
      from public.organization_members me
      join public.organization_members them on them.org_id = me.org_id
      where me.user_id = (select auth.uid())
        and them.user_id = p_profile_id
    );
$$;

-- ===========================================================================
-- PART 2 — enable RLS
-- ===========================================================================
--
-- Until these lines run, anyone holding the publishable key (which ships to
-- every browser) can read and write these tables freely.

alter table public.profiles              enable row level security;
alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.invitations           enable row level security;

-- ===========================================================================
-- PART 3 — policies
-- ===========================================================================
--
-- `using`      — which EXISTING rows are visible (select / update / delete)
-- `with check` — which NEW row values are allowed (insert / update)
--
-- An update policy usually needs both: `using` says which rows you may touch,
-- `with check` says what you may turn them into. Omitting `with check` on an
-- update would let someone move a row into another organization.

-- --- profiles --------------------------------------------------------------

create policy "profiles are visible to org colleagues"
  on public.profiles for select to authenticated
  using (public.can_see_profile(id));

create policy "users update only their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert policy: profiles are created exclusively by the handle_new_user
-- trigger. No delete policy: profiles disappear via cascade when the auth user
-- is deleted. Absent policy = denied, which is exactly what we want.

-- --- organizations ---------------------------------------------------------

create policy "members read their organizations"
  on public.organizations for select to authenticated
  using (id in (select public.user_org_ids()));

create policy "super admins update their organization"
  on public.organizations for update to authenticated
  using (public.has_org_role(id, 'super_admin'))
  with check (public.has_org_role(id, 'super_admin'));

create policy "super admins delete their organization"
  on public.organizations for delete to authenticated
  using (public.has_org_role(id, 'super_admin'));

-- Deliberately NO insert policy. Creating an organization also has to create
-- the creator's membership row, and those two writes must succeed or fail
-- together. That is handled by public.create_organization() in part 4.

-- --- organization_members --------------------------------------------------
-- The recursion trap lives here. Every policy below goes through a
-- security definer helper rather than querying this table directly.

create policy "members read memberships in their orgs"
  on public.organization_members for select to authenticated
  using (org_id in (select public.user_org_ids()));

create policy "super admins add members"
  on public.organization_members for insert to authenticated
  with check (public.has_org_role(org_id, 'super_admin'));

create policy "super admins change roles"
  on public.organization_members for update to authenticated
  using (public.has_org_role(org_id, 'super_admin'))
  with check (public.has_org_role(org_id, 'super_admin'));

-- A super admin may remove anyone; anyone may remove themselves (leave the org).
create policy "super admins remove members, users may leave"
  on public.organization_members for delete to authenticated
  using (
    public.has_org_role(org_id, 'super_admin')
    or user_id = (select auth.uid())
  );

-- --- invitations -----------------------------------------------------------

-- Visible to org admins, and to the person invited (matched on their email so
-- they can see the invite before accepting).
create policy "admins and invitees read invitations"
  on public.invitations for select to authenticated
  using (
    public.has_org_role(org_id, 'super_admin', 'inventory_manager')
    or lower(email) = lower((select auth.jwt() ->> 'email'))
  );

create policy "admins create invitations"
  on public.invitations for insert to authenticated
  with check (
    public.has_org_role(org_id, 'super_admin', 'inventory_manager')
    and invited_by = (select auth.uid())
  );

create policy "admins revoke invitations"
  on public.invitations for delete to authenticated
  using (public.has_org_role(org_id, 'super_admin', 'inventory_manager'));

-- Note there is no update policy. Accepting an invitation is done by
-- public.accept_invitation() in part 4, which needs to write the membership row
-- too — again, both writes or neither.

-- ===========================================================================
-- PART 4 — privileged operations
-- ===========================================================================
--
-- Some actions cannot be expressed as a policy because of a bootstrap problem:
-- to insert your membership row you must already be a member. Rather than
-- loosening the policies (which would let anyone add themselves to any org),
-- we expose narrow, explicit functions. Each one is a single transaction, so a
-- half-completed org or a consumed-but-unapplied invite is impossible.

-- Create an organization and make the caller its super admin.
create or replace function public.create_organization(
  p_name text,
  p_slug text
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_org     public.organizations;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (trim(p_name), lower(trim(p_slug)), v_user_id)
  returning * into v_org;

  insert into public.organization_members (org_id, user_id, role)
  values (v_org.id, v_user_id, 'super_admin');

  return v_org;
end;
$$;

-- Accept an invitation by its token.
create or replace function public.accept_invitation(p_token uuid)
returns public.organization_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid   := (select auth.uid());
  v_email   text   := (select auth.jwt() ->> 'email');
  v_invite  public.invitations;
  v_member  public.organization_members;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- `for update` locks the row, so two simultaneous clicks cannot both consume
  -- the same invitation.
  select * into v_invite
  from public.invitations
  where token = p_token
  for update;

  if v_invite.id is null then
    raise exception 'Invitation not found';
  end if;

  if v_invite.accepted_at is not null then
    raise exception 'Invitation has already been used';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'Invitation has expired';
  end if;

  -- The invite is addressed to an email. Requiring it to match the signed-in
  -- account stops a leaked link being redeemed by someone else.
  if lower(v_invite.email) <> lower(v_email) then
    raise exception 'This invitation was issued to a different email address';
  end if;

  insert into public.organization_members (org_id, user_id, role)
  values (v_invite.org_id, v_user_id, v_invite.role)
  on conflict (org_id, user_id) do update set role = excluded.role
  returning * into v_member;

  update public.invitations
  set accepted_at = now()
  where id = v_invite.id;

  return v_member;
end;
$$;

-- `authenticated` may call these; `anon` may not.
revoke all on function public.create_organization(text, text) from public, anon;
revoke all on function public.accept_invitation(uuid)         from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.accept_invitation(uuid)         to authenticated;

-- ===========================================================================
-- PART 5 — retire the Phase 0 smoke test
-- ===========================================================================

drop table if exists public.health_check;
