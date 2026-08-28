# Ordrfy — Project Reference

Multi-tenant WhatsApp/Instagram business assistant SaaS for Indian micro-businesses.
Tagline: "Chats in. Orders out."

This file is the persistent memory for this build across sessions. The full planning
document set lives in `C:\Users\m.fahiz\Downloads\ORDRFY\` (12 PDFs). Read this file
first in any new session — it already reconciles conflicts between those documents so
you don't need to re-read all 12 every time.

## Document precedence (highest wins on overlap)

1. `Ordrfy-Hardening-Addendum.pdf` — security, reliability, durability, kill switch, recovery, pre-launch checklist
2. `Ordrfy-Multi-Channel-Addendum.pdf` — channel architecture, schema (esp. contacts/contact_channel_identities), entitlements/pricing structure
3. `Ordrfy-Final-Implementation-Plan.pdf` — SLAs, operational thresholds, scaling triggers
4. `Ordrfy-Cost-Optimized-Stack.pdf` — infra/stack choices (re-verify all $/₹ figures before relying on them)
5. `Ordrfy-Scaling-Plan.pdf` — scaling reasoning background, subordinate to #3
6. `Ordrfy-Final-Architecture.pdf` — **NOT in the original prompt's reading list or the precedence doc, but is load-bearing.** It's the base schema, webhook durability flow (Section 9), idempotency design (Section 8), RLS pattern (Section 4), indexing (Section 13). Multi-Channel Addendum explicitly supersedes its `contacts` schema. Treat it as sitting just below the Multi-Channel Addendum.
7. `Ordrfy-V1-Master-Plan.pdf` — valid for: 3-verticals-together decision, general table concepts, screen lists, admin panel concept, phase sequencing. Superseded on: WhatsApp-only schema, old timeline.
8. `Ordrfy-Business-Plan.pdf` — market/pricing/tagline/GTM only, not technical scope (despite containing a lot of technical-looking content — that content is superseded by docs 1–4).
9. `Ordrfy-Technical-Spec.pdf`, `Ordrfy-Critical-Review.pdf` — historical only, explicitly marked "do not build against."
10. **Missing file**: the prompt's reading list names `Ordrfy-Tech-Stack-Final.md`, which does not exist in the folder. `Ordrfy-Final-Architecture.pdf` exists instead and is not mentioned in the prompt's list at all, despite being cited repeatedly by the Hardening Addendum. Flagged to user; treated as document #6 above.

## Session decisions (docs/decisions/) — rank above all 12 planning documents

These are the project owner's direct decisions made during this build, each addressing a
genuine provider limitation discovered during implementation — a permitted change-control
trigger, not a hypothetical concern. They supersede anything in the 12-document set on
their specific topic.

- `docs/decisions/2026-08-28-instagram-whatsapp-consent-routing.md` — Instagram reminders
  route through WhatsApp with explicit, customer-confirmed consent, rather than only
  falling back to manual owner follow-up. Supersedes the original "window-check + Needs
  Owner Attention" resolution to blocker #4 below.
- `docs/decisions/2026-08-28-round-2-recommendations.md` — WhatsApp reminder-template
  category guard, append-only consent history (DPDP Act), reminder-engine heartbeat
  monitoring, and a monitor-only note on per-tenant sending-reputation risk.
- `docs/decisions/2026-08-28-scale-proof-owner-experience.md` — WhatsApp messaging-tier
  tracking hook, a unified `owner_attention_queue` (this is now THE "Needs Owner Attention"
  mechanism — supersedes the earlier plan of querying `reminders` directly for that), and
  `business_settings` key conventions for instant-ack and notification-digest behavior.
- `docs/decisions/2026-08-28-india-owner-fit.md` — multi-language support (`language` on
  `internal_reply_rules`/`message_templates`, `preferred_language` on `businesses`),
  WhatsApp opt-out detection/honoring, and two Build-Phase-3+/4 UX decisions with no
  schema impact (App→API onboarding disclosure, single-tap owner actions).
- `docs/decisions/2026-08-28-vertical-expansion.md` — scope expansion from 3 to 5
  verticals (adds Baker/Custom Cake and Personalized/Surprise Gift). Introduces a
  `verticals` reference table (replacing hardcoded `CHECK` lists on five tables) and a
  generic `vertical_field_definitions`/`order_field_values` mechanism for vertical-specific
  order fields.
- `docs/decisions/2026-08-28-bakers-gift-businesses.md` — the actual Baker/Gift content
  (pipeline stages, field definitions, reply rules, templates, reminder types), resolving
  the gap the vertical-expansion addendum flagged. Baker and Gift are now `active = true`.
- `docs/decisions/2026-08-28-encryption-and-credentials-hardening.md` — confirmed (not
  assumed) encryption-at-rest/TLS claims against current Supabase docs; Vault-backed
  `credentials_ref` with two real bugs found and fixed while validating it (a default-ACL
  grant leak, a NOT NULL violation) — see the doc before touching
  `20260828120026_credential_vault_functions.sql` or `lib/secrets/vault.ts` again.
- `docs/decisions/2026-08-28-operational-loose-ends.md` — data offboarding decision
  (soft-delete only, simplifies away Final-Architecture's originally-planned scheduled
  hard-delete job), channel reconnection/reset hook, trial-expiry graceful degradation as a
  *separate* computed condition from `automation_paused` (deliberately not reusing that
  flag — see the doc for why), and a generalized `activity_log.actor_user_id` column.

## Locked scope

- **5 verticals** (expanded from the original 3 on 2026-08-28, see
  `docs/decisions/2026-08-28-vertical-expansion.md` and
  `docs/decisions/2026-08-28-bakers-gift-businesses.md`), built together, no sequencing (the
  Critical-Review doc's Fashion-first argument was explicitly rejected for the original 3
  — see doc, do not resurrect it, and the same non-sequencing principle applies to the
  expansion): **Fashion, Tutor, Appointment-Based Service, Baker/Custom Cake, Personalized/
  Surprise Gift**. All 5 are content-seeded and `active = true`.
- 2 channels, built together: **WhatsApp, Instagram** — via shared `MessagingChannelProvider` adapter interface
- Facebook Messenger: adapter pattern must support it later; do not build now
- **10 vertical×channel combinations** (5×2, was 6/3×2 before the expansion), all tested end-to-end before launch, plus multi-channel-business test and cross-vertical regression — content exists for all 10 now; actual Build Phase 6 testing against each is unstarted, same as it was for the original 6
- Timeline: 26–34 weeks honest estimate for the original 3×2 scope. Not a target to compress. **Not yet re-estimated for 5×2** — the vertical-expansion addendum didn't include a revised timeline, and CLAUDE.md should not invent one; flag this to the user rather than assuming the original estimate still holds.
- Priority order for every tradeoff: **security → reliability → working core product → simple maintainable architecture → cost optimization → future expansion**

## Non-negotiable architecture rules

1. **One shared engine.** Pipeline, template matching, reminders, payments, dashboard, tenant isolation, audit logging, kill switch — zero vertical or channel conditionals. Vertical differences live in `pipeline_stages` / `internal_reply_rules` / template config data. Channel differences live only inside adapters implementing `MessagingChannelProvider`.
2. **Contact identity is channel-independent**: `contacts` + `contact_channel_identities`, never a flat phone field. No auto-merge across channels in V1 (manual link is a V1.5 feature, additive). **Exception (2026-08-28, see docs/decisions/2026-08-28-instagram-whatsapp-consent-routing.md)**: a customer explicitly confirming "yes, message me on WhatsApp at this number" in-chat is a customer-confirmed link, not a system-inferred merge — this is allowed in V1 and does not depend on or unblock the V1.5 auto-merge item. Never conflate the two when reasoning about this rule.
3. **Multi-tenancy via Postgres RLS**, `business_id` resolved live via `business_memberships` + `auth.uid()` — never a static JWT claim. RLS policies ship in the same migration that creates the table, never retrofitted.
4. **Webhook durability**: verify signature → durably store (status `received`) → ack 200 → then process. Never ack before storing. No `waitUntil()`-only fire-and-forget on anything in the critical path.
5. **Idempotency everywhere**: `(provider, provider_message_id)` uniqueness on inbound messages; `idempotency_key` on reminders and on outbound auto-reply sends; `FOR UPDATE SKIP LOCKED` for concurrent reminder claiming.
6. **Mock providers first**: `MockWhatsAppProvider`, `MockInstagramProvider`, `MockPaymentProvider` fully built and tested before any real credentials.
7. **Admin kill switch** (`businesses.automation_paused`): suppresses outbound automation across *all* enabled channels for a business simultaneously. Inbound still logs normally. Must be tested against multi-channel businesses, not just one channel. **This flag means exactly one thing — admin-toggled — and nothing else.** Trial-expiry graceful degradation (round 4 rec. #16) is a *separate*, computed eligibility condition using `subscription_status`/`trial_ends_at`/`business_settings['trial_grace_period_days']`, never implemented by setting this same flag automatically — see `docs/decisions/2026-08-28-operational-loose-ends.md` for why overloading it is unsafe.
8. **No hardcoded pricing or channel counts**: `business_entitlements` gates channel access; pricing logic never hardcodes ₹299 or a channel count.

## Reconciled final schema (supersedes any single source document)

Base is `Final-Architecture.pdf` Section 3, with the Multi-Channel Addendum's contact-identity and channel tables layered on top, and the V1-Master-Plan's FK/settings refinements applied.

```
auth.users                        -- Supabase-managed

verticals                         -- NEW (vertical-expansion addendum) -- replaces hardcoded
                                   -- CHECK(vertical in (...)) lists on 5 different tables
  key (PK, text, e.g. 'fashion'|'tutor'|'service'|'baker'|'gift'), label, active, created_at
  -- active=false for baker/gift until their real pipeline/template content is seeded.
  -- Every `vertical text` column below now REFERENCES this instead of a CHECK list --
  -- deliberately still plain text everywhere (not a uuid FK) to avoid touching every
  -- existing text comparison (e.g. the pipeline-stage guard trigger, every seed.sql literal).

business_memberships
  id, user_id (FK auth.users), business_id (FK businesses), role ('owner' only in V1), created_at

admin_users
  id, user_id (FK auth.users, unique), name, mfa_required boolean default true

businesses
  id, name, phone, email, vertical (FK verticals.key),
  subscription_status ('trial'|'active'|'inactive'), trial_ends_at,
  timezone, preferred_language ('en' default, free text, not enum-constrained),
  automation_paused boolean default false,   -- kill switch
  created_at, deleted_at
  -- NOTE: no whatsapp_connected/whatsapp_number here — superseded by business_channel_connections
  -- preferred_language added india-owner-fit addendum #10 -- first-class column, not a
  -- business_settings key, same tier of importance as vertical/timezone

channels
  id, name ('whatsapp'|'instagram'|'facebook'), active boolean

business_channel_connections
  id, business_id, channel_id, provider_account_id, connected boolean,
  credentials_ref, disconnected_at (nullable), created_at,
  current_tier (nullable, WhatsApp-only, e.g. 'tier_250'|'tier_1k'|'tier_10k'|'tier_100k'|'unlimited'),
  tier_usage_today (nullable), tier_last_synced_at (nullable)
  -- tier_* columns added round 3 rec. #6 -- synced from the real provider in Build Phase 4,
  -- unused (null) until then; admin panel warns before this is hit, not after
  -- disconnected_at added round 4 rec. #15 -- basic audit timestamp for the admin-panel
  -- disconnect/reconnect reset action (Build Phase 4); never touches historical messages/contacts

business_entitlements
  id, business_id, entitlement_key ('channel:whatsapp'|'channel:instagram'), active boolean

pricing_plans                     -- admin-managed reference table, no hardcoded prices in code
  id, plan_name, entitlement_keys (array or join table)

contacts
  id, business_id, name, pipeline_stage_id (FK), is_high_priority,
  last_inbound_at, last_outbound_at, created_at, updated_at
  -- no phone/handle field

contact_channel_identities
  id, contact_id, business_id, channel_id, provider_user_id,
  phone_number (nullable), display_handle (nullable), provider_metadata jsonb,
  last_inbound_at (nullable), opted_out_at (nullable), created_at
  UNIQUE (business_id, channel_id, provider_user_id)   -- the actual inbound-resolution lookup key
  -- last_inbound_at is per-channel window state, used by the reminder engine's Instagram
  -- window check (see reminders below). When a WhatsApp identity row is created via the
  -- Instagram consent-routing flow, provider_metadata records how:
  --   { "linked_via": "instagram_consent_flow", "consented_at": "<timestamp>" }
  -- opted_out_at added india-owner-fit addendum #11 -- per-channel opt-out flag, one more
  -- data-driven condition in the reminder engine's send-eligibility check, not a new code path

pipeline_stages
  id, business_id (nullable = vertical default), vertical (FK verticals.key), stage_key, stage_label, sort_order

vertical_field_definitions        -- NEW (vertical-expansion addendum)
  id, vertical (FK verticals.key), field_key, field_label,
  field_type ('text'|'number'|'boolean'|'date'|'select'),
  select_options (text[], nullable), is_required, sort_order, active
  UNIQUE (vertical, field_key)
  -- Generic per-vertical order-field mechanism (cake flavour, occasion, personalization
  -- text, ...) -- structured, not jsonb, specifically so a field like surprise_required
  -- can be validated and queried, per the Gift dashboard's own stated requirement.

order_field_values                -- NEW (vertical-expansion addendum)
  id, contact_id, business_id, field_definition_id (FK vertical_field_definitions),
  value_text, value_number, value_boolean, value_date, created_at, updated_at
  UNIQUE (contact_id, field_definition_id)
  -- Exactly one value_* column populated per row, matching the referenced field's
  -- field_type -- enforced at the application layer (Build Phase 3), not a DB CHECK.

opt_out_keywords                  -- NEW (india-owner-fit addendum #11)
  id, business_id (nullable = global default), language, keyword, active
  UNIQUE (business_id, language, keyword)
  -- Checked against every inbound message BEFORE internal_reply_rules matching -- an
  -- opt-out phrase always wins over any other automation match.

messages
  id, contact_id, business_id, channel_id, direction, message_type, content,
  media_url, media_mime_type, provider_media_id,
  is_auto_reply, provider, provider_message_id,
  outbound_idempotency_key (nullable, unique) -- for auto-reply dedup, distinct from provider_message_id
  status ('pending_send'|'sent'|'failed', nullable, outbound only),
  created_at
  UNIQUE (provider, provider_message_id)

internal_reply_rules
  id, business_id (nullable), vertical (FK verticals.key), rule_key,
  language ('en' default), trigger_keywords (array), trigger_priority, reply_text, active
  UNIQUE (business_id, vertical, rule_key, language)
  -- language added india-owner-fit addendum #10 -- same rule_key can have one row per
  -- language instead of forcing mixed content into one row; matching prefers
  -- businesses.preferred_language, falls back to en

message_templates                 -- RENAMED from whatsapp_templates
  id, business_id (nullable), vertical (FK verticals.key), channel_id, template_key,
  language ('en' default), meta_template_name, meta_template_id,
  category ('utility'|'marketing'|'authentication', nullable), approval_status, parameters_schema,
  reply_text (nullable), active
  UNIQUE (business_id, vertical, channel_id, template_key, language)
  -- WhatsApp rows: Meta-approved template, required for anything outside the 24h window.
  -- Any WhatsApp row referenced by reminders.message_template_id MUST have category='utility'
  -- -- enforced by a DB trigger on reminders, not just app code (round 2 recommendation #1).
  -- "Marketing"/"Authentication" are real Meta categories but never valid for reminder use.
  -- "Service" is NOT a template category at all (it's the free-form in-window conversation
  -- type -- that's what internal_reply_rules covers) -- deliberately excluded from the enum.
  -- Instagram rows: not a real approval-gated template -- reply_text is used directly when
  -- the IG window is open, or when the reminder has been routed to WhatsApp via consent (see
  -- reminders/reminder_channel_consent below).

reminder_channel_consent          -- NEW (docs/decisions/2026-08-28-instagram-whatsapp-consent-routing.md)
  id, contact_id, business_id, requested_channel_id (FK channels), source_channel_id (FK channels),
  status ('pending'|'granted'|'declined'|'no_response'|'revoked'), requested_at, responded_at, created_at
  -- APPEND-ONLY: no UNIQUE(contact_id, requested_channel_id) -- a status change inserts a
  -- new row, never mutates an old one. UPDATE/DELETE blocked by a trigger for every role,
  -- including service_role (DPDP Act compliance, round 2 recommendation #2).
  -- Query current state via the current_reminder_channel_consent view (security_invoker=true
  -- so it actually respects RLS), never by treating one row in this table as "the" answer.

reminders
  id, business_id, contact_id, channel_id, reminder_type, scheduled_time_utc,
  message_template_id (FK, nullable), status ('pending'|'processing'|'sent'|'failed'),
  failure_reason (nullable, e.g. 'channel_unsupported'|'send_error'|'provider_error'),
  attempt_count, locked_at, idempotency_key (unique)
  -- Full send-eligibility gate, in order (later additions are prerequisite checks BEFORE
  -- the channel-selection logic, not replacements for it):
  --   0a. automation_paused = false for the business (admin kill switch, rule 7)
  --   0b. trial-eligibility per round 4 rec. #16 (subscription_status/trial_ends_at/grace period)
  --   0c. contact_channel_identities.opted_out_at is null for the target channel identity (india-fit rec. #11)
  --   Then channel selection (docs/decisions/2026-08-28-instagram-whatsapp-consent-routing.md):
  --   1. WhatsApp identity exists AND current_reminder_channel_consent.status='granted' -> send via WhatsApp template
  --   2. else Instagram window open (contact_channel_identities.last_inbound_at) -> send via Instagram directly
  --   3. else -> status='failed', failure_reason='channel_unsupported', insert into
  --      owner_attention_queue (reason='reminder_channel_unsupported') -- see that table's entry above

system_health                     -- NEW (round 2 recommendation #3)
  job_key (PK, e.g. 'reminder_engine'), last_run_at, updated_at
  -- Reminder-claiming job upserts its row every run; admin panel / scheduled check flags
  -- staleness above a threshold. Detects the engine silently stopping, which no individual
  -- reminder's status can reveal.

owner_attention_queue             -- NEW (round 3 recommendation #7) -- THE "Needs Owner
                                   -- Attention" mechanism; supersedes querying reminders directly
  id, business_id, contact_id (nullable), reason ('unmatched_message'|'ambiguous_match'|
    'media_message'|'reminder_channel_unsupported'|'manual_flag'),
  reference_type ('message'|'reminder'|'contact'), reference_id (nullable), created_at,
  resolved_at (nullable), resolved_by (FK auth.users, nullable)
  -- In ADDITION to activity_log, not a replacement: activity_log is the permanent audit
  -- trail, this is the actionable/resolvable queue. Oldest-unresolved-first + count badge
  -- are both a single query: order by created_at where resolved_at is null / count(*)
  -- where resolved_at is null. Also the signal source for which alerts are "urgent" vs.
  -- "batched into a digest" (round 3 rec. #9).

payments
  id, business_id, contact_id, order_reference, amount_due, amount_paid, status, due_date,
  created_at, updated_at

business_settings
  id, business_id, setting_key, setting_value
  -- reminder timing/silence-window overrides, defaulting to vertical standards.
  -- Known keys (all per-business, seeded from a vertical default at business creation,
  -- owner-editable after -- same established pattern, no schema change needed per new key):
  --   payment_reminder_delay_days, follow_up_silence_hours (original)
  --   instant_ack_enabled, instant_ack_text                (round 3 rec. #8)
  --   notification_digest_frequency_minutes, last_digest_sent_at (round 3 rec. #9)
  --   trial_grace_period_days                              (round 4 rec. #16 -- see reminders
  --     comment / docs/decisions/2026-08-28-operational-loose-ends.md for the eligibility
  --     formula; deliberately NOT implemented by reusing automation_paused, see that doc)

activity_log
  id, business_id, contact_id (nullable), event_type, event_detail,
  actor_user_id (nullable, FK auth.users), created_at
  -- event_type covers customer-facing AND automation/webhook/admin events (V1-Master-Plan Section 9a)
  -- actor_user_id added round 4 rec. #17, generalized beyond payments -- first-class "who
  -- did this" column (kill-switch toggles, vertical reassignment, channel reconnection,
  -- manual payment-status changes); null for automation-driven events, no human actor there

webhook_events                    -- NEW, not explicitly named in any doc but required by the
  id, channel_id, provider, provider_event_id,          -- durable-store-before-ack pattern
  business_id (nullable until resolved), raw_payload jsonb,
  status ('received'|'processing'|'processed'|'failed'), received_at, processed_at
```

Indexes (Final-Architecture Section 13, still valid, plus additions from this session): `contacts.business_id`; `contact_channel_identities(business_id, channel_id, provider_user_id)` unique; `messages(provider, provider_message_id)` unique; `messages.outbound_idempotency_key` unique; `reminders(scheduled_time_utc)` partial where `status='pending'`; `reminders(business_id, created_at)` partial where `status='failed' and failure_reason='channel_unsupported'` (the Needs Owner Attention admin queue query); `payments(business_id, status, due_date)`; `activity_log(business_id, created_at)`; `pipeline_stages(business_id, vertical)`; `reminder_channel_consent(contact_id, requested_channel_id, created_at desc)`.

Triggers: (1, Final-Architecture Section 5) `contacts.pipeline_stage_id` guard — rejects cross-tenant/cross-vertical stage assignment even on an application bug. (2, round 2 rec. #1) `reminders` insert/update guard — rejects attaching a non-`utility`-category WhatsApp template. (3, round 2 rec. #2) `reminder_channel_consent` append-only guard — rejects any UPDATE/DELETE for every role.

## Build order

1. **Foundation** — schema + migrations, Supabase Auth + RLS, admin panel skeleton with MFA, mock providers wired end-to-end. **Admin panel skeleton built and browser-tested (2026-08-28)**: `admin_users`-gated login, TOTP MFA enrollment + challenge (both actually exercised end-to-end in a browser, not just code review), businesses list/detail/create. Owner account creation/invite flow is explicitly NOT built yet (business detail page says so honestly) — that's the remaining Foundation gap.
   Hardening layers on top of `admin_users`+MFA gating (defense in depth, never the security boundary itself): host-aware `app/robots.ts` (disallows `/admin` today, will disallow everything once `admin.` is a real separate host); no links to `/admin` anywhere in marketing/app pages (check again whenever the business-owner app gets built); per-IP and per-(IP+email) rate limiting on `/api/admin/login` (`lib/rate-limit/`, in-memory locally, swaps to Upstash automatically once `UPSTASH_REDIS_REST_URL`/`TOKEN` are set — actually verified tripping correctly, both layers, not just written).
2. **Shared engine** — pipeline engine, template/auto-reply matching w/ priority+conflict rules, reminder engine (`pg_cron`+`pg_net`, `FOR UPDATE SKIP LOCKED`), webhook durability pattern, kill switch, manual recovery tools
3. **Vertical configuration** — real `pipeline_stages`/`internal_reply_rules` content for all 5 verticals (not placeholder). All 5 verticals' content exists in `seed.sql` as of 2026-08-28.
4. **Real provider integration** — `InteraktAdapter` (WhatsApp), `InstagramProvider` (Meta Graph API direct, no BSP), each tested against sandbox before live. Also where WhatsApp tier tracking (`business_channel_connections.current_tier`) actually gets synced, and where the App→API onboarding-tradeoff disclosure screen belongs (india-owner-fit addendum #12).
5. **Security hardening pass** — full automated test suite from Hardening Addendum
6. **Launch acceptance** — all 10 vertical×channel combos (5×2) + multi-channel + cross-vertical regression

## Known blockers / open questions

1. Instagram Business API review/approval timeline — unverified duration. **User is starting Meta Business/Instagram verification now, in parallel with Foundation/Shared Engine build (2026-08-28).** Not a code blocker.
2. Instagram messaging cost model — still not researched; blocks finalizing `business_entitlements` pricing *amounts* only, not schema. Revisit before entitlements/pricing lock and again at the mandatory pre-launch re-verification checkpoint.
3. Instagram = direct-to-Meta-Graph-API, no BSP — already confirmed in the Multi-Channel Addendum. Not actually a blocker despite being listed as one in the original prompt.
4. **RESOLVED (2026-08-28), then SUPERSEDED (2026-08-28)**: confirmed via Meta's own developer docs that Instagram Messaging API has no compliant way to send a business-initiated message outside the 24-hour window — no usable message tags, no Human Agent tag (Messenger-only), no Sponsored Messages/One-Time Notifications for Instagram. This is a hard platform constraint, not a design gap.
   The first resolution (window-check + Needs Owner Attention fallback, no automated Instagram-only reminders) has been **superseded same-day** by
   `docs/decisions/2026-08-28-instagram-whatsapp-consent-routing.md`: Instagram customers are asked, in-chat, for explicit consent to receive reminders via WhatsApp instead. See that doc and the `reminder_channel_consent` schema entry above for the full current logic. The window-check against `contact_channel_identities.last_inbound_at` is still used, but only as the *second* fallback (send directly on Instagram if the window happens to be open), not the only alternative to manual follow-up.
   **Real product implication, stated plainly**: Instagram-only businesses that never consent to WhatsApp contact, and whose Instagram window is closed at send time, still don't get an automated reminder in V1 — that residual case is `reminders.status='failed', failure_reason='channel_unsupported'`, surfaced for manual owner follow-up. This is a smaller gap than the original resolution left, not a fully eliminated one — Meta's platform constraint is still real.
5. `Ordrfy-Tech-Stack-Final.md` named in the prompt does not exist in the folder; `Ordrfy-Final-Architecture.pdf` exists but isn't in the prompt's list. Resolved by treating the latter as required background (see precedence section above) — flagged to user, no action needed.
6. Docker not installed on this machine — local Supabase dev (the documented zero-cost, local-first workflow) needs it. **User is installing Docker Desktop before Foundation-phase local dev work begins.** Migration SQL, project scaffolding, and provider code can all be written without Docker; only `supabase start` / actually running migrations locally is blocked until it's installed.
7. **Monitor only, not blocking (2026-08-28)**: per-tenant WhatsApp/Instagram sending-reputation isolation — see `docs/decisions/2026-08-28-round-2-recommendations.md` item 4. No schema or code change now; log any per-business reputation signal the real providers expose once Build Phase 4 wires them up.
8. **RESOLVED (2026-08-28)**: the "Bakers & Gift Businesses" source document was received same-day and fully seeded — see `docs/decisions/2026-08-28-bakers-gift-businesses.md`. `baker`/`gift` are `active = true` in `verticals`. Remaining work is Build Phase 6 end-to-end testing against all 10 combinations, not a content gap.
9. **This machine runs another, unrelated project (ASSETMIND360) side-by-side.** The Next.js dev server was moved off port 3000 to **3100** (`package.json` dev/start scripts, `.claude/launch.json`) after a real collision. **Not yet checked**: whether the local Supabase stack's ports (54321 API, 54322 DB, 54323 Studio, 54324 mail, etc. — all Supabase CLI defaults) also collide with anything else on this machine. Ask the user before assuming this is fine, or before changing `supabase/config.toml`'s ports (which would need `.env.local` updated to match and a stack restart).
10. **Admin owner-account creation/invite flow is not built.** The business detail page says this explicitly rather than silently omitting it. A business can be created via the admin panel, but there's currently no way to actually create the owner's login (`business_memberships` row + `auth.users` account) for them to sign in with. Needed before a real business can use the (not-yet-built) business-owner app.

## What NOT to build in V1

AI/NLP auto-replies, self-service signup, automated Razorpay subscription billing, in-app payment links, inventory/accounting/GST, advanced analytics, native mobile apps, team/multi-user accounts beyond what `business_memberships` already supports, catalogue integration, custom workflow builder, Facebook Messenger adapter, full-text search, value/results screen, contact activity timeline UI (log the data, skip the UI), universal search, polished admin UI (functional only), media message processing (log metadata, route to Needs Owner Attention), a dedicated job queue (pg_cron/pg_net is sufficient at V1 scale), **automated data export or a scheduled hard-delete pipeline** (round 4 rec. #14 — soft-delete via `businesses.deleted_at` only, indefinitely; explicit DPDP deletion requests are a manual admin action, not automated; this deliberately simplifies away Final-Architecture Section 11's originally-planned 30-day scheduled hard-delete job — not an oversight if a future session notices the job doesn't exist).
