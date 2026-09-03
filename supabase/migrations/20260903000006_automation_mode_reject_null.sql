-- Audit finding #4: the original automation_mode CHECK, `setting_key <> 'automation_mode' or
-- setting_value in (...)`, has the classic SQL NULL-in-CHECK gap -- when setting_value IS
-- NULL, `setting_value in (...)` evaluates to NULL (not FALSE), and a CHECK constraint only
-- REJECTS a row when its condition evaluates to FALSE; NULL is treated as passing. A NULL
-- automation_mode value -- which is not one of the four valid states and indicates a bad
-- write path, not a legitimate "absent" case (absence is modeled by having no row at all,
-- per lib/engine/automation.ts's own default-when-absent read) -- previously slipped through
-- undetected. Explicitly requiring setting_value is not null closes this.
alter table business_settings drop constraint business_settings_automation_mode_check;
alter table business_settings add constraint business_settings_automation_mode_check
  check (
    setting_key <> 'automation_mode'
    or (setting_value is not null and setting_value in ('rules_only', 'smart', 'ai_assisted', 'advanced_ai'))
  );
