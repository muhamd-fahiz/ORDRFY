create table payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  order_reference text,
  amount_due numeric(12, 2) not null,
  amount_paid numeric(12, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column payments.order_reference is
  'Lets one contact have multiple payment records over time (first order, second order, '
  'etc.) without a future schema migration.';

alter table payments enable row level security;

create policy "tenant_isolation_payments"
  on payments for all
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

-- Powers both the dashboard's "payments pending" view and the daily overdue-check job.
create index idx_payments_business_status_due on payments(business_id, status, due_date);
