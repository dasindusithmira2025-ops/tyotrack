import type { PrismaClient } from "@prisma/client";
import webpush from "web-push";

interface PushReminderInput {
  prisma: PrismaClient;
  tenantId: string;
  userId: string;
  shift: {
    id: string;
    date: string;
    dayOfWeek: string;
    startTime: string | null;
    endTime: string | null;
    location: string | null;
  };
}

export interface PushSendResult {
  status: "SENT" | "FAILED" | "SKIPPED";
  providerMessageId: string | null;
  errorMessage: string | null;
}

let vapidInitialized = false;
let warnedMissingConfig = false;

function getPushConfig() {
  const subject = (process.env.WEB_PUSH_SUBJECT ?? "").trim();
  const publicKey = (process.env.WEB_PUSH_PUBLIC_KEY ?? "").trim();
  const privateKey = (process.env.WEB_PUSH_PRIVATE_KEY ?? "").trim();

  return {
    subject,
    publicKey,
    privateKey
  };
}

function ensureVapidConfigured(): PushSendResult | null {
  const config = getPushConfig();

  if (!config.subject || !config.publicKey || !config.privateKey) {
    if (!warnedMissingConfig) {
      warnedMissingConfig = true;
      console.warn("[shift-push] WEB_PUSH_SUBJECT / WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY are not fully configured");
    }

    return {
      status: "SKIPPED",
      providerMessageId: null,
      errorMessage: "WEB_PUSH is not configured"
    };
  }

  if (!vapidInitialized) {
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    vapidInitialized = true;
  }

  return null;
}

function isSubscriptionGone(error: any): boolean {
  const statusCode = Number(error?.statusCode ?? error?.status ?? 0);
  return statusCode === 404 || statusCode === 410;
}

function buildPayload(shift: PushReminderInput["shift"]) {
  return JSON.stringify({
    title: "Shift starting in 1 hour",
    body: `${shift.dayOfWeek}, ${shift.date} - ${shift.location || "Unassigned"} - ${shift.startTime || "--:--"}-${shift.endTime || "--:--"}`,
    route: "/#/my-shifts",
    shiftId: shift.id,
    date: shift.date,
    dayOfWeek: shift.dayOfWeek,
    startTime: shift.startTime,
    endTime: shift.endTime,
    location: shift.location
  });
}

export async function sendShiftReminderBrowserPush(input: PushReminderInput): Promise<PushSendResult> {
  const configError = ensureVapidConfigured();
  if (configError) {
    return configError;
  }

  const subscriptions = await input.prisma.pushSubscription.findMany({
    where: {
      tenantId: input.tenantId,
      userId: input.userId
    },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      authSecret: true
    }
  });

  if (!subscriptions.length) {
    return {
      status: "SKIPPED",
      providerMessageId: null,
      errorMessage: "No active browser push subscriptions"
    };
  }

  const payload = buildPayload(input.shift);
  let sentCount = 0;
  const failedMessages: string[] = [];

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.authSecret
          }
        },
        payload
      );
      sentCount += 1;
    } catch (error: any) {
      if (isSubscriptionGone(error)) {
        await input.prisma.pushSubscription.delete({
          where: {
            id: subscription.id
          }
        }).catch(() => undefined);
        continue;
      }

      failedMessages.push(String(error?.message ?? error ?? "unknown web-push error"));
    }
  }

  if (sentCount > 0) {
    return {
      status: "SENT",
      providerMessageId: `web-push:${sentCount}`,
      errorMessage: failedMessages.length ? failedMessages.slice(0, 3).join("; ") : null
    };
  }

  if (!failedMessages.length) {
    return {
      status: "SKIPPED",
      providerMessageId: null,
      errorMessage: "No valid browser subscriptions were available"
    };
  }

  return {
    status: "FAILED",
    providerMessageId: null,
    errorMessage: failedMessages.slice(0, 3).join("; ")
  };
}
