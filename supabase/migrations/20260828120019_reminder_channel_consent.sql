-- Instagram -> WhatsApp consent-based reminder routing
-- (docs/architecture/decisions/0001-instagram-whatsapp-consent-routing.md).
--
-- APPEND-ONLY by design (docs/architecture/decisions/0003-append-only-reminder-channel-consent.md,
-- DPDP Act compliance): a status
-- change (e.g. granted -> revoked) INSERTs a new row referencing the same contact_id +
-- requested_channel_id; existing rows are never updated or deleted. "Current" consent
-- state for a contact is derived by querying the most recent row -- see the
-- current_reminder_channel_consent view below -- the same pattern already used for
-- append-only event logs like activity_log. This is deliberately NOT the same table shape
-- proposed in the original addendum text (which had a UNIQUE(contact_id,
-- requested_channel_id) constraint) -- that constraint would make a second, later consent
-- event for the same contact/channel impossible to record, which directly contradicts
-- append-only history. No unique constraint here on purpose.
create table reminder_channel_consent (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  requested_channel_id uuid not null references channels(id), -- e.g. whatsapp
  source_channel_id uuid not null references channels(id),    -- where the ask happened, e.g. instagram
  status text not null
    check (status in ('pending', 'granted', 'declined', 'no_response', 'revoked')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table reminder_channel_consent is
  'Append-only consent event log. Each row is a snapshot at one point in time (an ask went '
  'out, or a response/change arrived) -- never mutate an existing row. Re-asking after a '
  'decline/no_response inserts a new pending row once the business_settings-configured '
  'backoff period has elapsed. Blocked from UPDATE/DELETE at the database level (see trigger '
  'below), not just by application discipline, so a compliance dispute has a tamper-evident '
  'record.';

alter table reminder_channel_consent enable row level security;

-- Only SELECT and INSERT policies exist for the authenticated role -- Postgres denies any
-- operation with no matching policy when RLS is enabled, so UPDATE/DELETE are already
-- unreachable for tenant users without an explicit deny. The trigger below additionally
-- blocks UPDATE/DELETE regardless of role (including service_role, which bypasses RLS but
-- not triggers), so even server-side automation code cannot accidentally mutate history --
-- only a superuser temporarily disabling the trigger can, for a genuine data-correction need.
create policy "tenant_isolation_reminder_channel_consent_select"
  on reminder_channel_consent for select
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

create policy "tenant_isolation_reminder_channel_consent_insert"
  on reminder_channel_consent for insert
  with check (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

create or replace function reject_reminder_channel_consent_mutation()
returns trigger as $$
begin
  raise exception
    'reminder_channel_consent is append-only -- % is not permitted. Insert a new row instead. '
    'A superuser may temporarily disable trg_reminder_channel_consent_append_only for a '
    'genuine data-correction need.', tg_op;
end;
$$ language plpgsql;

create trigger trg_reminder_channel_consent_append_only
  before update or delete on reminder_channel_consent
  for each row execute function reject_reminder_channel_consent_mutation();

create index idx_reminder_channel_consent_lookup
  on reminder_channel_consent(contact_id, requested_channel_id, created_at desc);

-- "Current" consent state = the most recent row per (contact_id, requested_channel_id).
-- security_invoker = true is required here: migrations run as a superuser-like role, and a
-- view created without it executes with the OWNER's privileges, which silently bypasses RLS
-- on the underlying table for every caller -- exactly the cross-tenant leak the project's
-- own hardening tests exist to catch. With security_invoker, the view respects the
-- querying user's RLS policies as if they queried reminder_channel_consent directly.
create view current_reminder_channel_consent
  with (security_invoker = true) as
select distinct on (contact_id, requested_channel_id) *
from reminder_channel_consent
order by contact_id, requested_channel_id, created_at desc;

comment on view current_reminder_channel_consent is
  'The reminder engine and admin panel should read consent state through this view, never '
  'by querying reminder_channel_consent directly for "the" status of a contact -- that table '
  'holds full history, not current state.';
