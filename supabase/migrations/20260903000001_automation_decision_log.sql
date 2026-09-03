-- Phase 1 of the layered AI automation architecture
-- (docs/architecture/decisions/0035-layered-ai-automation-phase1.md). Purely additive: this
-- table is not referenced by any application code yet -- Layer 2 (AI classification) and
-- Layer 4's wiring into lib/engine/automation.ts are both Phase 2, not built here. Every
-- AI-shaped column is nullable and stays null until then.
--
-- Capability-aware from this, its first migration (capability/ai_provider/ai_model/
-- input_units/output_units), per the locked multi-model architecture decision -- adding
-- these later would mean a second migration plus backfill guesswork instead of an empty
-- column from day one.
create table automation_decision_log (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  decision_source text not null check (decision_source in ('layer1_rules', 'layer4_decision', 'human')),
  matched_rule_id uuid references internal_reply_rules(id),
  capability text check (capability in ('classification')),
  ai_provider text,
  ai_model text,
  input_units integer,
  output_units integer,
  detected_language text,
  detected_intent text,
  confidence numeric,
  action text not null,
  fallback_reason text,
  escalation_reason text,
  created_at timestamptz not null default now(),
  unique (message_id)
);

comment on table automation_decision_log is
  'Per-message audit trail answering "which layer handled this, and why": which layer '
  'decided (decision_source), whether/how AI participated (capability/ai_provider/ai_model/ '
  'confidence, all null when it did not), and the resulting action. In addition to '
  'activity_log (the permanent general audit trail) and owner_attention_queue (the '
  'actionable queue), not a replacement for either -- the same three-way split ADR-0006 '
  'already established. Not written to by any code path yet in this migration''s phase; a '
  'later phase adds the actual insert calls alongside the AI provider wiring.';

comment on column automation_decision_log.decision_source is
  'Who made the FINAL action decision -- layer1_rules (the existing deterministic keyword '
  'matcher, unchanged) or layer4_decision (the deterministic decideAction() function, '
  'lib/engine/automation-decision.ts, REGARDLESS of whether AI classification actually '
  'succeeded -- an ai_unavailable outcome is still a layer4_decision, just with null AI '
  'metadata columns). Never "layer2_ai": Layer 2 only classifies, it never decides, so '
  'naming a decision source after it would misrepresent where control actually lives. '
  '"human" is reserved for a future manually-recorded decision; nothing produces it yet.';

comment on column automation_decision_log.capability is
  'Which AI capability this row reflects, per the locked multi-model architecture decision. '
  'Only "classification" exists today -- generation and any other capability have zero '
  'implementation surface and are not valid values until a separate decision approves '
  'adding one.';

comment on column automation_decision_log.input_units is
  'Provider-neutral usage unit, deliberately not named *_tokens -- not every current or '
  'future AI provider bills in tokens. Null until a real provider call populates it.';

alter table automation_decision_log enable row level security;

create policy "tenant_isolation_automation_decision_log"
  on automation_decision_log for all
  using (
    business_id in (select business_id from business_memberships where user_id = auth.uid())
  );

create index idx_automation_decision_log_business_id on automation_decision_log(business_id);
