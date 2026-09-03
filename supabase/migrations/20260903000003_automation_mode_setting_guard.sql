-- Locks business_settings.setting_value to one of four known values specifically for
-- setting_key='automation_mode' (docs/architecture/decisions/0035-layered-ai-automation-phase1.md).
-- A deliberate, narrow deviation from this table's usual convention of leaving setting_value
-- unconstrained (every other key, e.g. trial_grace_period_days, is validated only at the
-- application layer) -- justified here because a typo'd or unexpected value in this specific
-- key controls whether AI-driven automation runs at all, not a display preference. The CHECK
-- is written against the row's own setting_key so it applies to this one key without
-- constraining any other key this table holds.
--
-- No existing business has a row at this key yet -- absence means 'rules_only', resolved in
-- application code, matching trial_grace_period_days' own default-when-absent pattern -- so
-- this constraint has nothing to validate retroactively; it only governs future writes.
alter table business_settings add constraint business_settings_automation_mode_check
  check (setting_key <> 'automation_mode' or setting_value in ('rules_only', 'smart', 'ai_assisted', 'advanced_ai'));
