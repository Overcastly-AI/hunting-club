#!/usr/bin/env bash
# Build a throwaway database from supabase/migrations and run the pgTAP tests.
#
# Usage:
#   supabase/scripts/db.sh reset   # fresh database with all migrations applied
#   supabase/scripts/db.sh test    # reset + pg_prove supabase/tests (each file includes
#                                  # scripts/test-helpers.sql)
#
# Connects with the standard libpq variables (PGHOST, PGPORT, PGUSER, PGPASSWORD) as a
# role that can create databases. HUNTCLUB_DB names the database (default huntclub_test);
# it is dropped and recreated every run, so never point this at real data.
#
# Plain PostgreSQL 15+ works: scripts/vanilla-postgres-shim.sql supplies the few
# Supabase objects (auth schema, API roles, default grants) the migrations expect.
# Tests need pgTAP and pg_prove (Debian/Ubuntu: postgresql-16-pgtap,
# libtap-parser-sourcehandler-pgtap-perl).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
supabase_dir="$(dirname "$here")"
db="${HUNTCLUB_DB:-huntclub_test}"
psql_db=(psql --no-psqlrc --quiet -v ON_ERROR_STOP=1 --dbname "$db")

reset() {
  dropdb --if-exists "$db"
  createdb "$db"
  "${psql_db[@]}" --file "$here/vanilla-postgres-shim.sql"
  for migration in "$supabase_dir"/migrations/*.sql; do
    "${psql_db[@]}" --single-transaction --output /dev/null --file "$migration"
  done
}

run_tests() {
  reset
  pg_prove --dbname "$db" --ext .sql --recurse "$supabase_dir/tests"
}

case "${1:-}" in
  reset) reset ;;
  test) run_tests ;;
  *)
    echo "usage: $0 reset|test" >&2
    exit 2
    ;;
esac
