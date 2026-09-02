-- Confirmed cross-tenant integrity gap (independent security audit, verified against this
-- codebase before any fix): contact_channel_identities, messages, reminders, and payments
-- all carry both business_id and contact_id, but neither a composite FK nor RLS nor any
-- existing trigger ever checked that the referenced contact actually belongs to the stated
-- business_id. RLS's tenant_isolation policies on these tables only check that business_id
-- itself belongs to the caller (business_id in (select business_id from business_memberships
-- where user_id = auth.uid())) -- they never inspect contact_id, so an authenticated owner of
-- Business A could insert a row with business_id = A but contact_id pointing at a contact
-- that actually belongs to Business B. Nothing in the Next.js app's own routes currently does
-- this (every route re-verifies contact ownership before writing), but per this project's own
-- stated design (RLS/DB-level guards are the real boundary, not app code -- see e.g.
-- trg_guard_contact_pipeline_stage, 20260828120018), a technically capable authenticated
-- caller can call the Supabase REST API directly with their own valid session, bypassing the
-- Next.js route layer entirely. This is directly exploitable today: nothing prevents one real
-- person from legitimately owning two separate Ordrfy businesses, in which case they already
-- know real contact_id values for both tenants.
--
-- Confirmed downstream effect: lib/engine/reminders.ts's processReminder() resolves a
-- reminder's contact_channel_identities purely by contact_id (never re-checking business_id),
-- so a reminders row crafted with business_id=A but contact_id=<Business B's real contact>
-- would resolve Business B's REAL WhatsApp/Instagram provider_user_id and attempt to send to
-- it -- and the eligibility gate (automation_paused, trial status) checks the ROW's stated
-- business_id (A), never the real contact-owning business (B), so B's own admin kill switch
-- has no effect against this. This trigger closes the gap at its root, for all four tables at
-- once, mirroring the exact pattern trg_guard_contact_pipeline_stage already established.
create or replace function guard_contact_business_match()
returns trigger as $$
declare
  contact_business_id uuid;
begin
  select business_id into contact_business_id from contacts where id = new.contact_id;

  if not found then
    raise exception '% : contact_id % does not exist', tg_table_name, new.contact_id;
  end if;

  if contact_business_id != new.business_id then
    raise exception '% : contact_id % belongs to business %, not %',
      tg_table_name, new.contact_id, contact_business_id, new.business_id;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_guard_contact_business_match_identities
  before insert or update of contact_id, business_id on contact_channel_identities
  for each row execute function guard_contact_business_match();

create trigger trg_guard_contact_business_match_messages
  before insert or update of contact_id, business_id on messages
  for each row execute function guard_contact_business_match();

create trigger trg_guard_contact_business_match_reminders
  before insert or update of contact_id, business_id on reminders
  for each row execute function guard_contact_business_match();

create trigger trg_guard_contact_business_match_payments
  before insert or update of contact_id, business_id on payments
  for each row execute function guard_contact_business_match();
