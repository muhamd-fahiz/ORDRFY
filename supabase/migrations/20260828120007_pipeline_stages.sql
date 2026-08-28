create table pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade, -- null = vertical-wide default
  vertical text not null references verticals(key),
  stage_key text not null,
  stage_label text not null,
  sort_order integer not null,
  unique (business_id, vertical, stage_key)
);

comment on table pipeline_stages is
  'business_id null = vertical-default stage row, shared by every business of that vertical. '
  'V1 populates only vertical-default rows for all 3 verticals. A future business-specific '
  'override becomes an additional row with that business''s id -- no schema migration needed '
  'when that day comes. Query pattern: fetch business-specific rows first, fall back to '
  'vertical defaults if none exist (Ordrfy-Final-Architecture.pdf Section 3).';

alter table pipeline_stages enable row level security;

create policy "pipeline_stages_readable"
  on pipeline_stages for select
  using (
    business_id is null
    or business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

-- Business-specific override rows are admin/service-role managed in V1 -- no self-service
-- pipeline editing yet -- so there is deliberately no owner-facing write policy here.

create index idx_pipeline_stages_business_vertical on pipeline_stages(business_id, vertical);
