# Reminder Runner

## What it does

The reminder runner calls `POST /api/internal/shifts/reminders/run` once every 60 seconds.
That endpoint finds due shifts, sends the reminder email, sends the browser notification when a subscription exists, and marks the shift as notified so it cannot be delivered twice.

## Run locally

1. Make sure `backend/.env` contains `SHIFT_REMINDER_RUNNER_TOKEN`.
2. Start the backend on `http://localhost:3061`.
3. Export the token in your shell.
4. Run the script:

```sh
export SHIFT_REMINDER_RUNNER_TOKEN="your-token-here"
./scripts/start-reminder-cron.sh
```

Optional override:

```sh
export REMINDER_RUNNER_URL="http://localhost:3061/api/internal/shifts/reminders/run"
./scripts/start-reminder-cron.sh
```

The script logs every attempt with a timestamp. A non-200 response is printed and the loop keeps running.

## cron-job.org setup for production

Use a one-minute cron job that sends a `POST` request to your production endpoint.

- URL: `https://your-domain.com/api/internal/shifts/reminders/run`
- Method: `POST`
- Frequency: every 1 minute
- Header name: `x-shift-run-token`
- Header value: the exact `SHIFT_REMINDER_RUNNER_TOKEN` value from production

Exact header format:

```text
x-shift-run-token: your-generated-runner-token
```

No request body is required.
