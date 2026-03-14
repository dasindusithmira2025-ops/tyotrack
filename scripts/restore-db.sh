#!/usr/bin/env sh
set -eu

# Restore a PostgreSQL SQL dump into a target PostgreSQL instance.
# Usage:
#   TARGET_DATABASE_URL="postgresql://user:pass@host:5432/db" ./scripts/restore-db.sh /path/to/backup.sql
#
# This script works for Neon, Supabase, Railway, or any standard PostgreSQL provider
# as long as TARGET_DATABASE_URL points to that provider.

if [ "$#" -lt 1 ]; then
  echo "Usage: TARGET_DATABASE_URL=postgresql://... $0 /path/to/backup.sql" >&2
  exit 1
fi

SQL_FILE="$1"
TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-}"

if [ ! -f "$SQL_FILE" ]; then
  echo "SQL file not found: $SQL_FILE" >&2
  exit 1
fi

if [ -z "$TARGET_DATABASE_URL" ]; then
  echo "TARGET_DATABASE_URL is required" >&2
  exit 1
fi

echo "About to restore SQL dump into target database."
echo "File: $SQL_FILE"
echo "Target: $TARGET_DATABASE_URL"
echo "This will execute SQL statements that may DROP/RECREATE database objects."
printf "Type RESTORE to continue: "
read -r CONFIRM

if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Restore canceled."
  exit 1
fi

psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
echo "Restore completed successfully."
