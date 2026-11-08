#!/usr/bin/env bash
# Applies the migrations to a throwaway local Postgres with a minimal stand-in for Supabase's
# auth schema, then exercises the atomic functions (daily limit, credit cap, single-use QR).
# Usage: bash scripts/check-schema.sh   (needs Postgres 15+ binaries on PATH or in /usr/lib/postgresql)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PGBIN:$PATH"
WORK="$(mktemp -d)"
PORT="${PORT:-54329}"
cleanup() { pg_ctl -D "$WORK/data" stop -m fast >/dev/null 2>&1 || true; }
trap cleanup EXIT

initdb -D "$WORK/data" -U postgres >/dev/null
pg_ctl -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" start >/dev/null
PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" <<'SQL'
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
SQL

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "applying $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

"${PSQL[@]}" -f "$ROOT/scripts/check-schema.sql"
echo "schema check passed"
