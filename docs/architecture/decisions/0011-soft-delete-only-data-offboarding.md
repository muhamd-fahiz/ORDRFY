# ADR-0011: Soft-Delete-Only Data Offboarding — No Automated Hard-Delete Pipeline

**Status:** Accepted (2026-08-28)
**Supersedes:** `Ordrfy-Final-Architecture.pdf` Section 11's originally-planned scheduled, automated hard-delete job 30 days after soft-delete.

## Context

Some decision is needed for what happens to a business's data when they leave. The original planning document specified soft-delete followed by an automated hard-delete job on a fixed schedule.

## Decision

Soft-delete only in V1. `businesses.deleted_at` already exists in the schema — use it, nothing new to build. Explicit customer/business data-deletion requests (relevant under India's DPDP Act, see ADR-0003's compliance context) are handled as a manual admin action, not a self-service or automated feature. Soft-delete persists indefinitely unless an admin manually intervenes for a specific deletion request.

## Alternatives Considered

- **Build the originally-planned scheduled 30-day hard-delete job.** Explicitly rejected as this decision's whole point — a deliberate simplification of Final-Architecture Section 11, not an oversight. This is the project owner's explicit decision, so it supersedes that section rather than needing reconciliation with it.

## Consequences

Added to CLAUDE.md's "What NOT to build in V1" list so a future session doesn't mistake the missing scheduled job for a bug. No automated data export pipeline exists either, for the same reason.
