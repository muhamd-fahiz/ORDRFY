// Bootstraps an admin_users account. There's no self-service admin signup by design (V1
// scope) -- this script is the only way the first admin (and any subsequent one) gets
// created, for local dev today and equally for a real deployment later.
//
// Usage:
//   node scripts/create-admin.mjs "Owner Name" owner@example.com a-strong-password
//
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment (see
// .env.local for local dev values). Uses the service-role client directly -- this is a
// one-off CLI script, not application request code, so it doesn't go through
// lib/db/server.ts's browser-safety guard.

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

async function main() {
  loadEnvLocal();

  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.error('Usage: node scripts/create-admin.mjs "Owner Name" owner@example.com a-strong-password');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) {
    console.error(`Failed to create auth user: ${createError.message}`);
    process.exit(1);
  }

  const { error: adminError } = await supabase
    .from("admin_users")
    .insert({ user_id: created.user.id, name, mfa_required: true });
  if (adminError) {
    console.error(`Failed to create admin_users row: ${adminError.message}`);
    process.exit(1);
  }

  console.log(`Admin created: ${email} (user_id: ${created.user.id})`);
  console.log("MFA enrollment will be required on first login.");
}

main();
