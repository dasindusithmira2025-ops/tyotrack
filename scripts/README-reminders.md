# In-House Shift Reminders

## What it does

The weekly shift reminder system now runs fully in-house inside the backend process.
It checks due shifts every minute, creates internal `notifications` records, and marks the related shift as notified.
No external cron service, SMTP provider, or third-party browser push gateway is required.

## How it runs

1. The backend auto-runner starts from authenticated app traffic.
2. The auto-runner interval is controlled by `SHIFT_REMINDER_AUTORUN_INTERVAL_MS`.
3. Reminder records are stored in the database table `notifications`.
4. The frontend polls `/api/notifications` and shows native browser notifications when permission is granted.

## Required backend env flags

```env
SHIFT_REMINDER_AUTORUN=true
SHIFT_REMINDER_AUTORUN_INTERVAL_MS=60000
```

## Optional internal trigger endpoint

The internal endpoint `POST /api/internal/shifts/reminders/run` can still be used for manual triggering.
It remains token-protected using `x-shift-run-token`.

