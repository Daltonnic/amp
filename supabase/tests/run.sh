#!/usr/bin/env bash
# Applies the migrations to a throwaway PostgreSQL cluster and runs the RLS
# assertions. Requires PostgreSQL 15+ binaries (initdb, pg_ctl, psql).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bindir="${PG_BINDIR:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
tmp="$(mktemp -d)"
# initdb refuses to run as root; use the postgres OS user when we are root.
as_pg=()
if [ "$(id -u)" = 0 ]; then as_pg=(runuser -u postgres --); chown postgres "$tmp"; chmod 755 "$tmp"; fi
trap '"${as_pg[@]}" "$bindir/pg_ctl" -D "$tmp/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$tmp"' EXIT
"${as_pg[@]}" "$bindir/initdb" -D "$tmp/data" -U postgres --auth=trust >/dev/null
"${as_pg[@]}" "$bindir/pg_ctl" -D "$tmp/data" -o "-k $tmp -p 54329 -c listen_addresses=''" -w start >/dev/null
psql=(psql -h "$tmp" -p 54329 -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${psql[@]}" -f "$here/auth-stub.sql"
for f in "$here"/../migrations/*.sql; do "${psql[@]}" -f "$f"; done
"${psql[@]}" -f "$here/rls.sql"
"${psql[@]}" -f "$here/chat.sql"
"${psql[@]}" -f "$here/calendar.sql"
"${psql[@]}" -f "$here/notifications.sql"
