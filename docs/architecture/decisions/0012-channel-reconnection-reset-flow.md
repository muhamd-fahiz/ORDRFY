# ADR-0012: Channel Reconnection Is a Reset, Not a Connection-History Table

**Status:** Accepted (2026-08-28)

## Context

A business may need to disconnect and later reconnect a WhatsApp or Instagram channel connection (e.g. a number change, a re-authorization). The reconnect/reset flow needed a schema decision before Build Phase 4's real provider integration could implement it.

## Decision

`business_channel_connections.disconnected_at` (`supabase/migrations/20260828120005_business_channel_connections.sql`) — a simple timestamp, not a connection-history table, matching the framing that this is "a reset, not a complex re-auth flow."

## Alternatives Considered

- **A dedicated connection-history table tracking every connect/disconnect event.** Rejected as unnecessary complexity for what the product actually needs — a single "when was this last disconnected" fact, not a full audit trail of every reconnection (which `activity_log` can already capture generically if needed, per ADR-0014).

## Consequences

Deferred to Build Phase 4 (alongside `InteraktAdapter`/`InstagramProvider`): the actual admin-panel disconnect/reconnect action. Disconnecting clears `connected`/`credentials_ref`/`provider_account_id` and sets `disconnected_at`; it never touches historical `messages`/`contacts` data. Reconnecting is a fresh connect flow reusing the same row.

## Notes

**Make the WhatsApp Business App → API tradeoff explicit during onboarding.** No schema or engine change — this is a content/flow requirement. Moving a number onto the API typically means giving up the free consumer WhatsApp Business App on that number; an explicit onboarding screen, shown before any number is connected, must surface this and guide the business toward either a second number or an informed accept. Belongs in Build Phase 4, before real `InteraktAdapter` onboarding is exposed to actual businesses.
