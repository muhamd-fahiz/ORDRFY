# Decisions Register

Open business decisions that need the project owner's input — distinct from
`docs/architecture/decisions/`, which records decisions already made. An item moves from
here into an ADR (or is dropped) once it's actually decided; it never sits in both places
at once.

| Status | Decision needed | Blocks | Opened |
|---|---|---|---|
| Open | Instagram messaging cost model — unresearched | Locking `business_entitlements` pricing *amounts* (schema is unaffected) | 2026-08-28 |
| Open | Timeline for the 5×2 scope — see finding below, needs the project owner's preference on how to track it | Nothing technical; blocks having an honest way to talk about "how much is left" | 2026-08-28 |
| Open | `business_settings` keys beyond `trial_grace_period_days` (`payment_reminder_delay_days`, `follow_up_silence_hours`, `instant_ack_enabled`/`instant_ack_text`, `notification_digest_frequency_minutes`) are documented in CLAUDE.md as owner-editable but have zero consuming code anywhere in the shared engine — found while scoping the owner-app Settings screen, which shipped scoped to real `businesses` profile fields only (name/phone/email/timezone/preferred_language) instead. Needs the project owner's call on when/whether to wire the actual engine behavior these keys are supposed to control. | The owner-app Settings screen's scope (currently profile-only); reminder timing/instant-ack/digest features stay unbuilt until this is resolved either way | 2026-08-30 |

## Resolved

- **Supabase stack port collision with ASSETMIND360** (opened 2026-08-28, resolved 2026-08-29): checked directly — only Docker's own relay processes hold ports 54321-54324/54327 right now, no collision. See CLAUDE.md known-blocker #9 for the residual-risk caveat (ASSETMIND360 wasn't running at check time, so this isn't airtight against every possible future overlap, just confirms no *current* conflict).

## Finding: the 26–34 week estimate doesn't rescale to this build model

The original estimate assumed a conventional engineering team's pace. Actual commit history
for Foundation + Shared Engine + all 5 verticals' content + CI + owner authentication + the
first owner-app screen spans about two calendar days of session work (2026-08-28 21:18 to
2026-08-29 14:35) — a pace a person-week-based formula can't meaningfully describe, so
scaling "26-34 weeks" up for 5 verticals instead of 3 would just be scaling the wrong
premise, not producing an honest number.

**Proposed alternative**: track remaining scope via the root README's status checklist and
the 10-combination launch-acceptance matrix (ADR-0020) rather than a calendar estimate —
both are concrete and falsifiable ("is this checked off or not"), where a week-count would
just be a guess dressed up as a number. Real provider integration's timing additionally
depends on Meta's review process, which is external and unpredictable regardless of
engineering pace (known blocker #1).

Still open: whether the project owner wants a hard number produced anyway, accepting the
caveats above, or accepts this scope-based tracking instead.

## How this differs from `docs/architecture/decisions/`

- **ADRs** record a decision that has been made, with the reasoning and alternatives considered — written *after* the call, as a permanent record.
- **This register** tracks a decision that has *not* been made yet, because it genuinely needs the project owner's input (research, a real-world check, a business call) rather than something an engineering session can reason its way to. Once resolved, the row is removed here and (if it's architecturally significant) a new ADR is added.
