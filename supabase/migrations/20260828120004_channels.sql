create table channels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('whatsapp', 'instagram', 'facebook')),
  active boolean not null default false
);

comment on table channels is
  'Global channel registry. A facebook row exists (active = false) so business_entitlements '
  'and business_channel_connections never need a schema change to add it later -- only a new '
  'FacebookMessengerProvider implementing MessagingChannelProvider, explicitly not built in V1.';

-- Reference table, no tenant data -- readable by any authenticated user.
alter table channels enable row level security;

create policy "channels_readable_by_authenticated"
  on channels for select
  using (auth.role() = 'authenticated');
