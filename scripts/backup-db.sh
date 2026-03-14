#!/usr/bin/env sh
set -eu

# Daily PostgreSQL backup runner for TyoTrack.
#
# Schedule example (run every day at 02:30 server time):
# 30 2 * * * /path/to/repo/scripts/backup-db.sh >> /path/to/repo/scripts/backup-db.cron.log 2>&1
#
# Required env:
# - DB_BACKUP_TOKEN: token expected by /api/internal/db/backup
# Optional env:
# - BACKUP_API_URL: full endpoint URL (default uses localhost)
# - BACKUP_DIR: local backup rotation directory (default /backups)

BACKUP_API_URL="${BACKUP_API_URL:-http://localhost:3061/api/internal/db/backup?mode=save&exportType=sql-full&triggeredBy=scheduled}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
LOG_FILE="${BACKUP_DIR}/backup-job.log"
TOKEN="${DB_BACKUP_TOKEN:-}"

if [ -z "$TOKEN" ]; then
  echo "$(date -Iseconds) [ERROR] DB_BACKUP_TOKEN is not set" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TMP_BODY="$(mktemp)"
TMP_ERR="$(mktemp)"
STATUS="$(curl -sS -o "$TMP_BODY" -w "%{http_code}" "$BACKUP_API_URL" -H "x-backup-token: $TOKEN" -H "Accept: application/json" 2>"$TMP_ERR" || true)"

if [ "$STATUS" = "200" ]; then
  echo "$(date -Iseconds) [SUCCESS] backup saved :: $(cat "$TMP_BODY")" | tee -a "$LOG_FILE"
else
  if [ "$STATUS" = "000" ]; then
    echo "$(date -Iseconds) [ERROR] curl failed :: $(cat "$TMP_ERR")" | tee -a "$LOG_FILE" >&2
  else
    echo "$(date -Iseconds) [ERROR] HTTP $STATUS :: $(cat "$TMP_BODY")" | tee -a "$LOG_FILE" >&2
  fi
  rm -f "$TMP_BODY" "$TMP_ERR"
  exit 1
fi

rm -f "$TMP_BODY" "$TMP_ERR"

# Rotate backup files older than 30 days.
find "$BACKUP_DIR" -type f -name 'tyotrack-backup-*' -mtime +30 -print -delete | while read -r old_file; do
  echo "$(date -Iseconds) [ROTATE] deleted old backup: $old_file" | tee -a "$LOG_FILE"
done
