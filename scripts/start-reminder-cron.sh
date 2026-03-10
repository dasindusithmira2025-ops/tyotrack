#!/usr/bin/env sh
set -u

RUNNER_URL="${REMINDER_RUNNER_URL:-http://localhost:3061/api/internal/shifts/reminders/run}"
TOKEN="${SHIFT_REMINDER_RUNNER_TOKEN:-}"

if [ -z "$TOKEN" ]; then
  echo "$(date -Iseconds) [fatal] SHIFT_REMINDER_RUNNER_TOKEN is not set"
  exit 1
fi

while true; do
  timestamp="$(date -Iseconds)"
  body_file="$(mktemp)"
  error_file="$(mktemp)"
  status="$(curl -sS -o "$body_file" -w "%{http_code}" -X POST "$RUNNER_URL" -H "x-shift-run-token: $TOKEN" -H "Accept: application/json" 2>"$error_file" || true)"

  if [ "$status" = "200" ]; then
    printf '%s [200] %s\n' "$timestamp" "$(cat "$body_file")"
  elif [ "$status" = "000" ]; then
    printf '%s [curl-error] %s\n' "$timestamp" "$(cat "$error_file")"
  else
    printf '%s [%s] %s\n' "$timestamp" "$status" "$(cat "$body_file")"
  fi

  rm -f "$body_file" "$error_file"
  sleep 60
done
