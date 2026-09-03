# Architecture Decision Records

One file per significant technical decision: what was decided, why, what alternatives were
considered, and any real bugs found while building it. Read CLAUDE.md first — it's the
current-state reference; these records are the reasoning trail behind it.

A reversed decision gets a new ADR that marks the old one **Superseded** — never delete or
rewrite history. Numbers are assigned in the order decisions were made and are never reused.

| # | Title | Status |
|---|---|---|
| [0001](0001-instagram-whatsapp-consent-routing.md) | Instagram reminders route through WhatsApp via customer-confirmed consent | Accepted |
| [0002](0002-whatsapp-template-category-guard.md) | WhatsApp reminder templates locked to utility category, enforced at the database | Accepted |
| [0003](0003-append-only-reminder-channel-consent.md) | `reminder_channel_consent` is append-only, enforced by trigger for every role | Accepted |
| [0004](0004-reminder-engine-heartbeat-monitoring.md) | Reminder-engine heartbeat monitoring via `system_health` | Accepted |
| [0005](0005-whatsapp-tier-tracking-columns.md) | WhatsApp messaging-tier tracking columns added ahead of the sync logic | Accepted |
| [0006](0006-unified-owner-attention-queue.md) | Unified `owner_attention_queue` as the single "Needs Owner Attention" mechanism | Accepted |
| [0007](0007-multi-language-support.md) | Multi-language support via `language` columns and `preferred_language` | Accepted |
| [0008](0008-whatsapp-opt-out-handling.md) | Detect and honor WhatsApp opt-outs automatically | Accepted |
| [0009](0009-verticals-reference-table.md) | `verticals` reference table replaces hardcoded CHECK lists | Accepted |
| [0010](0010-generic-vertical-field-definitions.md) | Generic vertical-specific order fields via `vertical_field_definitions` | Accepted |
| [0011](0011-soft-delete-only-data-offboarding.md) | Soft-delete-only data offboarding — no automated hard-delete pipeline | Accepted |
| [0012](0012-channel-reconnection-reset-flow.md) | Channel reconnection is a reset, not a connection-history table | Accepted |
| [0013](0013-trial-expiry-separate-from-kill-switch.md) | Trial-expiry degradation is a separate condition, never `automation_paused` | Accepted |
| [0014](0014-activity-log-actor-generalization.md) | `activity_log.actor_user_id` generalized beyond payments | Accepted |
| [0015](0015-vault-backed-credentials.md) | Supabase Vault-backed `credentials_ref`, with two real bugs found and fixed | Accepted |
| [0016](0016-carbon-pink-design-tokens.md) | "Carbon Pink" design tokens, namespaced separately from the admin panel | Superseded by 0021 |
| [0017](0017-owner-authentication-model.md) | Owner authentication model — admin-provisioned accounts, no mandatory MFA | Accepted |
| [0018](0018-route-handler-session-checks.md) | Route handlers check session state directly, never call the redirect-based guard | Accepted |
| [0019](0019-today-view-mutation-design.md) | Today-view mutation design — "Review" semantics and send-reminder idempotency | Accepted |
| [0020](0020-mock-verified-before-real-providers.md) | Full product built and verified against mocks before any real provider integration | Accepted |
| [0021](0021-carbon-pink-extended-to-admin-panel.md) | Extend Carbon Pink to the admin panel, reversing ADR-0016's "admin stays untouched" call | Accepted |
| [0022](0022-marketing-site-carbon-pink-extension.md) | Marketing site built on Carbon Pink, with four new tokens (ink.raised, paper.warm, pink.hover, highlight) | Accepted |
| [0023](0023-launch-acceptance-webhook-driven-pass.md) | Launch Acceptance verified via real webhook payloads, not fixture inserts -- two real gaps found and fixed first | Accepted |
| [0024](0024-pre-friend-testing-ux-fixes.md) | Pre-friend-testing UX fixes -- marketing login link, dead CTA fix, error/404 pages, clearer empty states | Accepted |
| [0025](0025-auth-page-fixes-and-approved-ux-items.md) | Auth page layout/logo fixes, password reset built end-to-end, contact search, Mark-as-Paid confirmation | Accepted |
| [0026](0026-dev-mode-mobile-and-tunnel-hydration-fixes.md) | Dev-mode mobile testing and Cloudflare Tunnel hydration fixes -- allowedDevOrigins wildcard, MailtoButton | Accepted |
| [0027](0027-simplicity-pass-plain-language-and-safe-dropdowns.md) | Simplicity pass -- plain business language, safe Settings dropdowns, hidden empty states | Accepted |
| [0028](0028-per-contact-manual-takeover-scope.md) | Per-contact manual takeover -- scoped design, not approved for implementation | Proposed |
| [0029](0029-cross-tenant-integrity-fixes-pre-hardening.md) | Cross-tenant integrity fixes -- contact/business guard trigger, manual reminder-trigger scoping | Accepted |
| [0030](0030-timezone-and-webhook-recovery-fixes.md) | Manual reminder timezone fix (IST calendar day) and webhook recovery worker | Accepted |
| [0031](0031-marketing-sticky-header-fix-and-whatsapp-contact.md) | Marketing sticky-header bug fix, WhatsApp contact CTAs, About Us placeholder | Accepted |
| [0032](0032-admin-panel-desktop-scale-vertical-dashboards-settings.md) | Admin panel desktop scale-up, per-vertical dashboards, Settings (profile/password/MFA) | Accepted |
| [0033](0033-admin-subscriptions-tab.md) | Admin Subscriptions tab -- status/filters plus a manually-set amount | Accepted |
| [0034](0034-admin-dashboard-tab.md) | Admin Dashboard tab -- real aggregates, hand-rolled charts, new landing page | Accepted |
| [0035](0035-layered-ai-automation-phase1.md) | Layered AI automation, Phase 1 -- decision contract and audit schema only, no provider yet | Accepted |
| [0036](0036-phase2-ai-classification-wiring.md) | Phase 2 -- AI classification provider wiring, automation_mode='smart' only | Accepted |
| [0037](0037-webhook-recovery-and-audit-fixes.md) | Independent Phase 2 audit -- webhook recovery, tenant-guard, and validation fixes | Accepted |
| [0038](0038-phase2-final-hardening.md) | Final Phase 2 hardening -- atomic message claiming, full retry-cap coverage, shared-rule vertical integrity | Accepted |

## Migration note

These records replace `docs/decisions/` (8 dated addendum-batch files, retired 2026-08-29).
Each original file bundled several unrelated decisions under one "when it arrived" document;
they're unbundled here into one ADR per actual decision. A handful of items from those files
weren't decisions in the ADR sense (a "monitor only, not building this" note, a content/copy
requirement with no schema impact, a content-seeding record, a verification of an existing
fact) — those are folded into the **Notes** section of whichever ADR they're most related to,
rather than each getting a thin standalone file.
