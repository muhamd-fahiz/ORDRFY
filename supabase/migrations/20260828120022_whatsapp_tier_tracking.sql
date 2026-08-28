-- Round 3 recommendation #6: WhatsApp Business numbers start capped at a business-initiated
-- conversation tier (commonly referred to as 250/1K/10K/100K/unlimited per rolling 24h
-- period) that Meta raises automatically based on messaging quality and consistent usage.
-- Tracking it lets the admin panel warn proactively before a growth spike causes silent
-- send failures at the worst possible time.
--
-- These columns are populated from the real provider (Interakt/Meta Graph API) in Build
-- Phase 4 -- there is nothing to sync in mock mode, and no local computation can substitute
-- for Meta's authoritative tier assignment. Nullable and unused until then.
alter table business_channel_connections
  add column current_tier text
    check (current_tier is null or current_tier in ('tier_250', 'tier_1k', 'tier_10k', 'tier_100k', 'unlimited')),
  add column tier_usage_today integer,
  add column tier_last_synced_at timestamptz;

comment on column business_channel_connections.current_tier is
  'WhatsApp-specific; always null for Instagram rows. Exact tier identifier strings must be '
  're-verified against Interakt/Meta''s actual API response format at Phase 4 implementation '
  'time -- treat the check constraint values above as directionally correct, not confirmed '
  'API contract, consistent with the project''s "re-verify provider specifics before relying '
  'on them" principle.';

comment on column business_channel_connections.tier_usage_today is
  'Rolling 24h business-initiated-conversation count against current_tier. Admin panel '
  'should warn at a configurable threshold (e.g. 80% of tier) BEFORE sends start failing, '
  'not after (round 3 recommendation #6, docs/decisions/2026-08-28-scale-proof-owner-experience.md).';
