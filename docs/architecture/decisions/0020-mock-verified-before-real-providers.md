# ADR-0020: Full Product Built and Verified Against Mocks Before Any Real Provider Integration

**Status:** Accepted (2026-08-29)
**Supersedes:** The original build order's sequencing, where "Real provider integration" (Phase 4) preceded "Launch acceptance" (Phase 6, all 10 vertical×channel combinations tested end-to-end).

## Context

The original 6-phase build order interleaved real provider work before full end-to-end
verification: Foundation → Shared engine → Vertical configuration → Real provider
integration → Security hardening → Launch acceptance. Under that order, WhatsApp/Instagram
integration would begin before every screen, workflow, and vertical×channel combination had
been built and proven out against the mock providers.

Two factors argue against that order specifically for this project: Instagram Business API
review/approval timeline is unverified and outside anyone's control (known blocker #1), so
there's no schedule benefit to starting real integration early — it can't be rushed by
starting sooner. And the owner app itself (Phase 2.5) is still shallow — one real screen
(Today) exists; contacts, payments, and other workflows are still ahead — so real-provider
work would currently be integrating against a product that isn't feature-complete yet,
risking rework if a screen built after real integration lands needs provider-facing changes
too.

## Decision

Build and verify the complete product — every owner-app screen, every workflow, all 5
verticals, all 10 vertical×channel combinations — end-to-end against the mock providers
first. Real WhatsApp/Instagram integration (Interakt adapter, Instagram Graph API) comes
**last**, after security hardening, not before it.

Revised order: Foundation → Shared engine → Owner app (all screens) → Vertical
configuration → **Launch acceptance (mock-verified, all 10 combinations)** → Security
hardening → **Real provider integration**.

This does not relax the mock providers' own bar — see the companion discipline recorded in
`lib/README.md`'s Channels section: since the full product won't be validated against real
WhatsApp/Instagram behavior until this last phase, `MockWhatsAppProvider`/
`MockInstagramProvider` must stay faithful to the real APIs' documented payload shapes,
webhook formats, and response timing as they're built against, not just "good enough to
make the current screen work" — a fidelity gap discovered only at real-integration time
would be exactly the expensive-late-discovery this sequencing is meant to avoid elsewhere.

## Alternatives Considered

- **Keep the original order** (real provider integration before full launch acceptance).
  Rejected — no schedule benefit given Meta's unpredictable review timeline, and real risk
  of integrating against an incomplete product.
- **Start Meta Business/Instagram verification only once engineering reaches that phase.**
  Rejected — the review process is external and unpredictable; running it in parallel now
  costs nothing and removes it as a potential blocker once engineering actually gets there.

## Consequences

The Meta Business verification process starts now, in parallel, even though the
corresponding engineering work is deliberately last — these are independent, not
sequenced against each other. `docs/decisions-register.md`'s timeline-re-estimate item is
directly informed by this reordering: "weeks until launch" now depends on finishing the
mock-verified full product, not on when real provider work starts.
