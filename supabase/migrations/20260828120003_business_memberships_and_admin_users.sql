create table business_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')), -- 'staff' reserved for V2
  created_at timestamptz not null default now(),
  unique (user_id, business_id)
);

comment on table business_memberships is
  'business_id is resolved live via this table + auth.uid() in every RLS policy -- never a '
  'static JWT claim, which would go stale if membership changed after login '
  '(Ordrfy-Final-Architecture.pdf Section 4). A single owner_id column on businesses would '
  'work for V1 but requires a migration + backfill the day V2 needs a second staff login; '
  'this table costs nothing extra to query in V1 (one row per business) and makes V2 team '
  'accounts an insert, not a migration.';

alter table business_memberships enable row level security;

create policy "members_see_own_memberships"
  on business_memberships for select
  using (user_id = auth.uid());

-- Tenant isolation for businesses itself -- defined here, not in 0002, because it depends
-- on business_memberships existing.
create policy "tenant_isolation_businesses"
  on businesses for all
  using (
    id in (select business_id from business_memberships where user_id = auth.uid())
  );

create table admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  mfa_required boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table admin_users is
  'Admin metadata linked to the SAME auth.users row -- not a separate auth system. Admin '
  'panel API routes verify membership here server-side (requester is an authenticated, '
  'MFA-enrolled admin), then use the service-role client internally; the service-role key '
  'never reaches the browser (Ordrfy-Final-Architecture.pdf Section 4). Because admin '
  'operations go through the service-role client -- which bypasses RLS entirely -- there is '
  'deliberately no cross-tenant RLS policy granted to admins on any table; the authorization '
  'check lives in application code at the API route, not in a Postgres policy.';

alter table admin_users enable row level security;

create policy "users_see_own_admin_row"
  on admin_users for select
  using (user_id = auth.uid());
