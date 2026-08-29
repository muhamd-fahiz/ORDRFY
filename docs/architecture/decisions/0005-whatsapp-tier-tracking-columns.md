# ADR-0005: WhatsApp Messaging-Tier Tracking Columns Added Ahead of the Sync Logic

**Status:** Accepted (2026-08-28)

## Context

New WhatsApp Business numbers start capped at a business-initiated conversation tier (commonly 250/1K/10K/100K/unlimited per rolling 24h period) that Meta raises automatically based on messaging quality and consistent usage — not instantly. A sudden customer-base spike can hit the cap right when Ordrfy needs to work best, with no local way to predict it.

## Decision

`business_channel_connections` gains `current_tier`, `tier_usage_today`, `tier_last_synced_at` (`supabase/migrations/20260828120022_whatsapp_tier_tracking.sql`) — nullable, WhatsApp-specific, unused until Build Phase 4.

## Alternatives Considered

- **Compute or guess a tier locally from mock-mode usage.** Rejected — there is no real tier to sync in mock mode, and no local computation can substitute for Meta's authoritative assignment. Building a guessed version now would just need replacing once real provider integration lands.

## Consequences

Deferred to Build Phase 4 (real provider integration, alongside `InteraktAdapter`): actually syncing `current_tier`/`tier_usage_today` from Interakt/Meta's API; an admin-panel warning at a configurable threshold (e.g. 80%) before sends start failing; admin-panel copy explaining how tier increases work (steady usage with real unique customers over a rolling week raises the tier automatically; a bulk contact dump does not).

## Notes

**Per-tenant sending-reputation isolation — monitor only, not a V1 decision.** WhatsApp and Instagram both maintain an internal quality/reputation score per business messaging account. Since Ordrfy sends on behalf of many small-business tenants, likely through a shared BSP layer (Interakt) or a shared Meta Graph API app for Instagram, one tenant behaving badly (spam complaints, high block rates) could risk affecting sending ability for other tenants, depending on how the provider architects per-business separation. This is explicitly *not* a V1 build item — deferred per the project's own "cost optimization → future expansion" priority ordering, flagged here as a known platform-level risk to monitor once real tenants are live, not something to design around before launch. Action for Build Phase 4: if `InteraktAdapter`/`InstagramProvider` expose any per-business reputation/quality signal via their APIs, log it into `activity_log` from day one — cheap to add then, expensive to retrofit later — even if nothing acts on the signal yet.
