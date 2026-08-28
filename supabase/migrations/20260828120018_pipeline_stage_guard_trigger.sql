-- Database-level guard: even a bug in application code cannot assign a contact to a
-- pipeline_stages row that doesn't belong to its business, or to a vertical-default row for
-- the wrong vertical. Enforcing this in a trigger, not just application code, means the
-- database itself rejects an invalid assignment.
create or replace function guard_contact_pipeline_stage()
returns trigger as $$
declare
  stage_business_id uuid;
  stage_vertical text;
  contact_business_vertical text;
begin
  if new.pipeline_stage_id is null then
    return new;
  end if;

  select business_id, vertical into stage_business_id, stage_vertical
  from pipeline_stages
  where id = new.pipeline_stage_id;

  if not found then
    raise exception 'pipeline_stage_id % does not exist', new.pipeline_stage_id;
  end if;

  if stage_business_id is not null and stage_business_id != new.business_id then
    raise exception 'pipeline_stage_id % belongs to a different business than %',
      new.pipeline_stage_id, new.business_id;
  end if;

  if stage_business_id is null then
    select vertical into contact_business_vertical
    from businesses
    where id = new.business_id;

    if stage_vertical != contact_business_vertical then
      raise exception 'pipeline_stage_id % is a % default stage, but business % is vertical %',
        new.pipeline_stage_id, stage_vertical, new.business_id, contact_business_vertical;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_guard_contact_pipeline_stage
  before insert or update of pipeline_stage_id on contacts
  for each row execute function guard_contact_pipeline_stage();
