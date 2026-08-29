# Decisions Register

Open business decisions that need the project owner's input — distinct from
`docs/architecture/decisions/`, which records decisions already made. An item moves from
here into an ADR (or is dropped) once it's actually decided; it never sits in both places
at once.

| Status | Decision needed | Blocks | Opened |
|---|---|---|---|
| Open | Instagram messaging cost model — unresearched | Locking `business_entitlements` pricing *amounts* (schema is unaffected) | 2026-08-28 |
| Open | Confirm local Supabase stack ports (54321/54322/54323/54324) don't collide with anything else on this machine | Nothing today; blocks changing `supabase/config.toml`'s ports without risk of a silent conflict later | 2026-08-28 |
| Open | Re-estimate the 26–34 week timeline for the 5×2 (vertical×channel) scope — never redone after the 3→5 vertical expansion | Nothing technical; blocks having an honest current timeline to plan against | 2026-08-28 |

## How this differs from `docs/architecture/decisions/`

- **ADRs** record a decision that has been made, with the reasoning and alternatives considered — written *after* the call, as a permanent record.
- **This register** tracks a decision that has *not* been made yet, because it genuinely needs the project owner's input (research, a real-world check, a business call) rather than something an engineering session can reason its way to. Once resolved, the row is removed here and (if it's architecturally significant) a new ADR is added.
