#!/usr/bin/env bash
# Runs every tests/sql/*.sql file against the local Supabase Postgres instance in order.
# Each file wraps its own fixtures in BEGIN/ROLLBACK, so tests never leave data behind and
# can safely run in any order against a shared database (including the dev DB, not just CI).
#
# DB_URL defaults to the Supabase CLI's well-known local connection string (`supabase status`
# reports the same value). Override via DB_URL for CI, where `supabase start` may report a
# different host/port.
set -euo pipefail

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
SQL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tests/sql"

shopt -s nullglob
files=("$SQL_DIR"/*.sql)
shopt -u nullglob

if [ ${#files[@]} -eq 0 ]; then
  echo "No SQL test files found in $SQL_DIR"
  exit 1
fi

failures=0
for f in "${files[@]}"; do
  echo "=== Running $(basename "$f") ==="
  if psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"; then
    echo "--- $(basename "$f"): OK"
  else
    echo "--- $(basename "$f"): FAILED"
    failures=$((failures + 1))
  fi
  echo
done

if [ "$failures" -gt 0 ]; then
  echo "$failures SQL test file(s) failed."
  exit 1
fi

echo "All SQL tests passed."
