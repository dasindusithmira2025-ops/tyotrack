import webpush, { type PushSubscription } from "web-push";
import type { ShiftRecord } from "@/lib/shifts/service";

interface PushSendResult {
  status: "SENT" | "SKIPPED";
  providerMessageId: string | null;
  errorMessage: string | null;
  expiredEndpoints: string[];
}

function isConfigured(): boolean {
  return Boolean(
    process.env.WEB_PUSH_SUBJECT && process.env.WEB_PUSH_PUBLIC_KEY && process.env.WEB_PUSH_PRIVATE_KEY
  );
}

function ensureConfigured() {
  if (!isConfigured()) {
    return false;
  }

  webpush.setVapidDetails(
    process.env.WEB_PUSH_SUBJECT as string,
    process.env.WEB_PUSH_PUBLIC_KEY as string,
    process.env.WEB_PUSH_PRIVATE_KEY as string
  );

  return true;
}

export async function sendShiftBrowserNotification(
  shift: ShiftRecord,
  subscriptions: Array<{ endpoint: string; p256dh: string; authSecret: string }>
): Promise<PushSendResult> {
  if (!subscriptions.length) {
    return { status: "SKIPPED", providerMessageId: null, errorMessage: "No browser subscriptions", expiredEndpoints: [] };
  }

  if (!ensureConfigured()) {
    return { status: "SKIPPED", providerMessageId: null, errorMessage: "Web Push is not configured", expiredEndpoints: [] };
  }

  const payload = JSON.stringify({
    title: "Shift starting in 1 hour",
    body: `${shift.dayOfWeek}, ${shift.date} • ${shift.location || "Unassigned"} • ${shift.startTime || "--:--"}-${shift.endTime || "--:--"}`,
    tag: `shift-${shift.id}`,
    data: {
      shiftId: shift.id,
      date: shift.date
    }
  });

  const expiredEndpoints: string[] = [];
  let sentCount = 0;

  for (const subscription of subscriptions) {
    const target: PushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.authSecret
      }
    };

    try {
      await webpush.sendNotification(target, payload);
      sentCount += 1;
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        expiredEndpoints.push(subscription.endpoint);
        continue;
      }

      throw error;
    }
  }

  if (!sentCount) {
    return {
      status: "SKIPPED",
      providerMessageId: null,
      errorMessage: expiredEndpoints.length ? "All browser subscriptions expired" : "No browser notifications were sent",
      expiredEndpoints
    };
  }

  return {
    status: "SENT",
    providerMessageId: `browser:${sentCount}`,
    errorMessage: null,
    expiredEndpoints
  };
}

