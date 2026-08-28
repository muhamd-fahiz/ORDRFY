create table business_entitlements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  entitlement_key text not null, -- e.g. 'channel:whatsapp', 'channel:instagram'
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, entitlement_key)
);

comment on table business_entitlements is
  'Gates channel access and features, checked at the API layer before allowing a channel '
  'connection or displaying that channel''s data. Pricing/access logic reads this table -- '
  'never a hardcoded price or hardcoded channel count in application code '
  '(Non-Negotiable Architecture Rule 8; Ordrfy-Multi-Channel-Addendum.pdf Section 4).';

alter table business_entitlements enable row level security;

create policy "tenant_isolation_business_entitlements"
  on business_entitlements for all
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

create index idx_business_entitlements_business_id on business_entitlements(business_id);

create table pricing_plans (
  id uuid primary key default gen_random_uuid(),
  plan_name text not null unique,
  entitlement_keys text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table pricing_plans is
  'Admin-managed reference table mapping a plan name to the entitlement_keys it grants. No '
  'price amount is stored in application code; actual prices are set here by an admin once '
  'real cost-to-serve is known -- Instagram messaging cost specifically is still unresearched '
  '(see CLAUDE.md "Known blockers" #2), so no plan should be marked active with real pricing '
  'until that is closed.';

-- Admin-only table: no tenant RLS policy. Read/write happens exclusively via the
-- service-role client from authenticated admin routes (see admin_users comment).
alter table pricing_plans enable row level security;
