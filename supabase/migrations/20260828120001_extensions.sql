-- Core Postgres extensions required by the shared engine.
-- pgcrypto: gen_random_uuid() for all primary keys.
-- pg_cron + pg_net: reminder scheduler. Vercel's free/Hobby cron tier is limited to 2 jobs
-- run at most once/day -- nowhere near sufficient for 5-15 minute reminder polling, and
-- ties reliability to a specific paid plan tier. pg_cron runs inside Postgres itself (zero
-- network hop to check "what's due"); pg_net lets it invoke a Next.js API route to perform
-- the actual send (Ordrfy-Final-Architecture.pdf Section 6 -- the one flagged correction
-- from the earlier Vercel-Cron-only design).
create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;
