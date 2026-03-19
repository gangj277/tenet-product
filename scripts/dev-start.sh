#!/usr/bin/env bash
set -euo pipefail

# ── Ensure local PostgreSQL is running ────────────────────────────────────────
PG_SERVICE="postgresql@17"

if ! pg_isready -h localhost -p 5432 -q 2>/dev/null; then
  echo "⏳ Starting $PG_SERVICE..."
  brew services start "$PG_SERVICE" >/dev/null 2>&1

  # Wait up to 10 seconds for postgres to accept connections
  for i in $(seq 1 20); do
    if pg_isready -h localhost -p 5432 -q 2>/dev/null; then
      break
    fi
    sleep 0.5
  done

  if pg_isready -h localhost -p 5432 -q 2>/dev/null; then
    echo "✅ PostgreSQL is ready"
  else
    echo "❌ PostgreSQL failed to start — check: brew services info $PG_SERVICE"
    exit 1
  fi
else
  echo "✅ PostgreSQL already running"
fi

# ── Create database if it doesn't exist ───────────────────────────────────────
DB_NAME="tenet_dev"
if ! psql -h localhost -p 5432 -lqt 2>/dev/null | cut -d\| -f1 | grep -qw "$DB_NAME"; then
  echo "⏳ Creating database $DB_NAME..."
  createdb -h localhost -p 5432 "$DB_NAME"
  echo "✅ Database $DB_NAME created"
else
  echo "✅ Database $DB_NAME exists"
fi

# ── Run pending Drizzle migrations ────────────────────────────────────────────
echo "⏳ Running migrations..."
npx drizzle-kit push --force 2>&1 | tail -1
echo "✅ Migrations up to date"

# ── Start Next.js dev server ──────────────────────────────────────────────────
exec npx next dev
