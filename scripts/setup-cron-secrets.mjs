// Seeds the two Vault secrets 20260828120028_reminder_engine_cron.sql's pg_cron job reads
// at execution time: the reminder-cron endpoint URL and the shared secret that route
// checks (app/api/cron/reminders/route.ts). Re-running this script updates both in place
// (delete + recreate) rather than erroring on a duplicate name -- safe to run again after
// changing CRON_INTERNAL_SECRET or redeploying to a new URL.
//
// Reuses store_provider_credential/get_provider_credential (20260828120026) even though
// this isn't a WhatsApp/Instagram provider credential -- those wrappers are generic Vault
// access points, not provider-specific, so a second identical pair of functions for "cron
// config" would just be duplication.
//
// Usage: node scripts/setup-cron-secrets.mjs <endpoint-url>
// Reads CRON_INTERNAL_SECRET from .env.local (or process.env).

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnvLocal() {
  try {
    const contents = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
    for (const line of contents.split("\n")) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2];
      }
    }
  } catch {
    // .env.local not present -- rely on whatever's already in process.env.
  }
}

async function upsertSecret(supabase, name, value, description) {
  const { data: existingId, error: getError } = await supabase.rpc("get_secret_id_by_name", { p_name: name });
  if (getError) throw new Error(`Lookup failed for ${name}: ${getError.message}`);

  if (existingId) {
    const { error } = await supabase.rpc("update_provider_credential", { p_secret_id: existingId, p_secret: value });
    if (error) throw new Error(`Failed to update ${name}: ${error.message}`);
    console.log(`Updated existing secret: ${name}`);
    return;
  }

  const { error } = await supabase.rpc("store_provider_credential", { p_name: name, p_secret: value, p_description: description });
  if (error) throw new Error(`Failed to store ${name}: ${error.message}`);
  console.log(`Created new secret: ${name}`);
}

async function main() {
  loadEnvLocal();

  const [endpointUrl] = process.argv.slice(2);
  const cronSecret = process.env.CRON_INTERNAL_SECRET;

  if (!endpointUrl) {
    console.error("Usage: node scripts/setup-cron-secrets.mjs <endpoint-url>");
    console.error("Example: node scripts/setup-cron-secrets.mjs http://host.docker.internal:3100/api/cron/reminders");
    process.exit(1);
  }
  if (!cronSecret) {
    console.error("CRON_INTERNAL_SECRET must be set in .env.local or the environment.");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  await upsertSecret(supabase, "cron_reminder_endpoint_url", endpointUrl, "Target URL the reminder-engine pg_cron job posts to.");
  await upsertSecret(supabase, "cron_internal_secret", cronSecret, "Shared secret app/api/cron/reminders/route.ts checks.");

  console.log("Done. The pg_cron job will pick these up on its next scheduled run (every 5 minutes).");
}

main();
