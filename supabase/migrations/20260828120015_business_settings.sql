create table business_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  setting_key text not null,
  setting_value text,
  unique (business_id, setting_key)
);

comment on table business_settings is
  'Per-business overrides (e.g. payment_reminder_delay_days, follow_up_silence_hours), '
  'defaulting to vertical standards -- never hardcoded constants in application code.';

alter table business_settings enable row level security;

create policy "tenant_isolation_business_settings"
  on business_settings for all
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );
