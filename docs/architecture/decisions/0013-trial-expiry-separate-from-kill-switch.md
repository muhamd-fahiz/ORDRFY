# ADR-0013: Trial-Expiry Degradation Is a Separate Computed Condition, Never `automation_paused`

**Status:** Accepted (2026-08-28)

## Context

A business whose trial has expired without converting to a paid subscription needs its outbound automation to degrade gracefully. The originally suggested implementation was to reuse `businesses.automation_paused` — the same flag as the admin kill switch — to represent this state too.

## Decision

Built as a **separate, computed condition** instead. `automation_paused` stays exclusively the admin-toggled kill switch, meaning exactly one thing (Non-Negotiable Architecture Rule 7), matching how the Hardening Addendum originally specified it ("toggleable only by an authenticated admin"). The actual send-eligibility check (Build Phase 2, alongside the WhatsApp-consent/Instagram-window/opt-out checks from ADR-0001/ADR-0008) adds one more condition, computed from columns that already exist:

```
automation eligible = NOT automation_paused
  AND (subscription_status = 'active'
       OR (subscription_status = 'trial'
           AND now() < trial_ends_at + business_settings['trial_grace_period_days'] days))
```

New `business_settings` key: `trial_grace_period_days` (per-business, vertical-defaulted at creation). During and after the grace period, inbound messages are always durably stored and visible in the admin panel regardless of this check — degradation only ever affects outbound automation, never data capture, consistent with how the kill switch already behaves.

## Alternatives Considered

- **Reuse `automation_paused` for trial-expiry pausing too** (the originally suggested approach). Rejected: one boolean can't safely represent two independent reasons for the same state. If trial-expiry pausing also set `automation_paused = true`, an admin manually un-pausing a business for an unrelated reason (e.g. after fixing an automation bug) could accidentally resume sends for a business that's *also* trial-expired and hasn't paid — or conversely, a business converting to `active` after a grace-period pause wouldn't automatically resume unless the code specifically remembered *why* it was paused in the first place.

## Consequences

No new schema beyond the one `business_settings` key. This is one of the clearest examples in the project of why a single flag cannot safely encode two independently-triggered pause reasons — worth keeping in mind before overloading `automation_paused` (or any other single boolean) for a new use case in the future.
