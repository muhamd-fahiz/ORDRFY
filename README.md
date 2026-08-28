# Ordrfy

Multi-tenant WhatsApp/Instagram business assistant SaaS for Indian micro-businesses.
Tagline: "Chats in. Orders out."

See [CLAUDE.md](./CLAUDE.md) for the full reconciled architecture reference (schema,
precedence order, build order, and known blockers) derived from the complete planning
document set.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Install Docker Desktop** and make sure it's running — local Supabase dev
   (Postgres + Auth + RLS + Edge Functions, entirely local and free) depends on it.

3. **Start the local Supabase stack**

   ```bash
   npm run db:start
   ```

   This prints a local `API URL`, `anon key`, and `service_role key`. Copy `.env.example`
   to `.env.local` and fill them in.

4. **Apply migrations + seed data** (happens automatically on `db:start` for a fresh
   stack; to re-apply after a schema change):

   ```bash
   npm run db:reset
   ```

5. **Run the app**

   ```bash
   npm run dev
   ```

## Current status: Foundation phase

- ✅ Full schema + RLS migrations (`supabase/migrations/`), reconciled across the planning
  document set (see CLAUDE.md for precedence resolution)
- ✅ Vertical-default seed data for Fashion, Tutor, Service (`supabase/seed.sql`)
- ✅ `MessagingChannelProvider` interface + `MockWhatsAppProvider` / `MockInstagramProvider`
  (`lib/channels/`)
- ✅ `PaymentProvider` interface + `MockPaymentProvider` (`lib/payments/`)
- ⬜ Admin panel skeleton with MFA
- ⬜ Shared engine (pipeline, automation matching, reminder scheduler, webhook durability,
  kill switch)
- ⬜ Vertical configuration (real pipeline stages / reply rules content)
- ⬜ Real provider integration (Interakt, Instagram Graph API, Razorpay)

All providers default to mock mode (`WHATSAPP_PROVIDER=mock`, `INSTAGRAM_PROVIDER=mock`,
`PAYMENT_PROVIDER=mock` in `.env.example`) — nothing touches a real WhatsApp number, a real
Instagram account, or real money until Build Order Phase 4.
