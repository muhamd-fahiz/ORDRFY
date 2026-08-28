# Ordrfy Addendum — Additional Recommendations (Round 2)

**Status: ACCEPTED (2026-08-28), items 1–3 implemented; item 4 is a monitor-only note, not
a V1 build item.** Read alongside CLAUDE.md and
`2026-08-28-instagram-whatsapp-consent-routing.md`. Pricing/cost figures are intentionally
excluded — admin-adjustable later, not a build-blocking item.

## 1. Lock WhatsApp template category to prevent misclassification

**Problem:** WhatsApp templates must be categorized (Utility, Marketing, Authentication).
Reminders (fee due, payment due, appointment) must always be filed as **Utility** —
cheaper, stricter opt-in rules, less likely to be flagged. If a reminder template is ever
submitted as Marketing, it costs more and carries different compliance risk.

**Built:**
- `message_templates.category` is a DB-constrained enum: `'utility' | 'marketing' | 'authentication'`.
  (Note: "Service" is not a template category in Meta's actual model — it's the free-form,
  no-template-needed conversation type for replies inside the open window, which is exactly
  what `internal_reply_rules` already covers. The enum intentionally does not include it;
  see `supabase/migrations/20260828120012_message_templates.sql`.)
- Database-level guard (not just application code): a trigger on `reminders`
  (`20260828120020_reminder_template_category_guard.sql`) rejects any insert/update that
  attaches a WhatsApp `message_template_id` whose `category` isn't `utility`. Instagram
  rows are exempt — they aren't real Meta-approved templates and `category` is nullable
  for them.
- Still to do in the admin panel UI (Build Phase 3+): surface this constraint at
  template-setup time so a human configuring a vertical's reminder flow gets an immediate,
  readable error instead of only hitting the DB trigger.

## 2. Make consent records append-only (India DPDP Act compliance)

**Problem:** Ordrfy stores customer phone numbers, chat history, and now WhatsApp-messaging
consent (via the Instagram→WhatsApp addendum). India's DPDP Act requires businesses to be
able to demonstrate valid consent for processing personal data. If a customer later
disputes being messaged, the business needs a durable, tamper-evident record of what was
agreed and when.

**Built** (`supabase/migrations/20260828120019_reminder_channel_consent.sql`):
- `reminder_channel_consent` is append-only: a status change (granted → revoked) inserts a
  **new** row referencing the same `contact_id` + `requested_channel_id`; existing rows are
  never updated. **Deviation from the original addendum text**: that text proposed a
  `UNIQUE (contact_id, requested_channel_id)` constraint, which would make it impossible to
  ever insert a second consent event for the same contact/channel — directly contradicting
  "append-only history." Built without that constraint.
- DB-level enforcement: a trigger rejects any `UPDATE`/`DELETE` on the table outright
  (`trg_reminder_channel_consent_append_only`), for every role including `service_role` —
  triggers fire regardless of RLS bypass, so this is a real guarantee, not just an RLS gap.
  A superuser can temporarily disable the trigger for a genuine data-correction need.
- "Current" state is derived via `current_reminder_channel_consent`, a view selecting the
  most recent row per `(contact_id, requested_channel_id)` — same pattern as `activity_log`.
  Built with `security_invoker = true`, which is required for a view over an RLS-protected
  table to actually enforce that RLS for callers (without it, a view created by a
  superuser-like migration role silently bypasses RLS for everyone — a real cross-tenant
  leak risk caught and fixed during this build, not present in the original addendum text).

## 3. Add reminder-engine heartbeat monitoring (catch silent failures)

**Problem:** Individual reminder failures are tracked (`reminders.status = 'failed'`), but
nothing detects if the **entire engine** stops running (e.g. the `pg_cron` job silently
stops firing). In that scenario nothing shows as failed — nothing shows as anything.

**Built** (`supabase/migrations/20260828120021_system_health.sql`):
- `system_health(job_key, last_run_at, updated_at)` — a single row per monitored job.
  The reminder-claiming job upserts its row every run (Build Phase 2 implementation:
  `lib/engine/reminders.ts`).
- Still to do (Build Phase 2/5): the actual admin-panel indicator / scheduled check
  reading this table and flagging staleness above a threshold (e.g. no activity for 2+
  hours against a 5–15 minute run interval) — this table is the queryable source of truth
  that alerting reads from, complementary to the Final-Implementation-Plan's real-time
  Sentry Cron Monitoring alert, not a replacement for it.

## 4. Per-tenant sending reputation isolation — monitor only, not V1-blocking

**Problem:** WhatsApp and Instagram both maintain an internal quality/reputation score per
business messaging account. Since Ordrfy sends on behalf of many small-business tenants,
likely through a shared BSP layer (Interakt) or a shared Meta Graph API app for Instagram,
one tenant behaving badly (spam complaints, high block rates) could risk affecting sending
ability for other tenants, depending on how the provider architects per-business
separation.

**Decision**: not a V1 build item — defer per the project's own "cost optimization →
future expansion" priority ordering. Flagged here as a known platform-level risk to monitor
once real tenants are live, not something to design around before launch.

**Action for Build Phase 4** (real provider integration): if `InteraktAdapter` /
`InstagramProvider` expose any per-business reputation/quality signal via their APIs, log
it into `activity_log` from day one — cheap to add then, expensive to retrofit later — even
if nothing acts on the signal yet.
