import { PrismaClient, ShiftNotificationChannel, ShiftNotificationStatus, ShiftStatus } from "@prisma/client";
import { DateTime } from "luxon";
import { SHIFT_TIMEZONE } from "@/lib/shifts/time";
import { sendShiftReminderEmail } from "./email";
import { sendShiftBrowserNotification } from "./push";

interface ReminderRunResult {
  processed: number;
  notified: number;
  skipped: number;
  failed: number;
}

const emailMisconfigured =
  process.env.SHIFT_EMAIL_MODE === "smtp" &&
  (!process.env.SMTP_HOST || !process.env.SMTP_FROM || !process.env.SMTP_USER || !process.env.SMTP_PASS);
const pushMisconfigured =
  !process.env.WEB_PUSH_SUBJECT || !process.env.WEB_PUSH_PUBLIC_KEY || !process.env.WEB_PUSH_PRIVATE_KEY;

if (emailMisconfigured || pushMisconfigured) {
  console.warn(
    "[shift-reminders] Reminder delivery is partially configured. SMTP mode requires SMTP_HOST/SMTP_FROM/SMTP_USER/SMTP_PASS, and browser notifications require WEB_PUSH_SUBJECT/WEB_PUSH_PUBLIC_KEY/WEB_PUSH_PRIVATE_KEY."
  );
}

async function acquireShiftLock(prisma: PrismaClient, shiftId: string): Promise<boolean> {
  const result = await prisma.$queryRaw<Array<{ locked: boolean }>>`
    SELECT pg_try_advisory_lock(hashtext(${shiftId})) AS locked
  `;

  return Boolean(result[0]?.locked);
}

async function releaseShiftLock(prisma: PrismaClient, shiftId: string): Promise<void> {
  await prisma.$queryRaw`
    SELECT pg_advisory_unlock(hashtext(${shiftId}))
  `;
}

async function upsertDelivery(prisma: PrismaClient, tenantId: string, shiftId: string, channel: ShiftNotificationChannel) {
  return prisma.shiftNotificationDelivery.upsert({
    where: {
      shiftId_channel: {
        shiftId,
        channel
      }
    },
    create: {
      tenantId,
      shiftId,
      channel,
      status: ShiftNotificationStatus.PENDING
    },
    update: {}
  });
}

export async function runShiftReminderDispatch(prisma: PrismaClient): Promise<ReminderRunResult> {
  const now = DateTime.now().setZone(SHIFT_TIMEZONE).toUTC().toJSDate();
  const dueShifts = await prisma.shift.findMany({
    where: {
      status: ShiftStatus.ACTIVE,
      isDayOff: false,
      notificationSent: false,
      reminderDueAtUtc: {
        lte: now
      }
    },
    include: {
      worker: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      deliveries: true
    },
    orderBy: {
      reminderDueAtUtc: "asc"
    }
  });

  const result: ReminderRunResult = { processed: 0, notified: 0, skipped: 0, failed: 0 };

  for (const shift of dueShifts) {
    const locked = await acquireShiftLock(prisma, shift.id);
    if (!locked) {
      result.skipped += 1;
      continue;
    }

    try {
      result.processed += 1;
      const freshShift = await prisma.shift.findUnique({
        where: { id: shift.id },
        include: {
          worker: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          deliveries: true
        }
      });

      if (!freshShift || freshShift.notificationSent || freshShift.status === ShiftStatus.DELETED) {
        result.skipped += 1;
        continue;
      }

      const emailDelivery = await upsertDelivery(prisma, freshShift.tenantId, freshShift.id, ShiftNotificationChannel.EMAIL);
      const pushDelivery = await upsertDelivery(prisma, freshShift.tenantId, freshShift.id, ShiftNotificationChannel.PUSH);

      let emailStatus = emailDelivery.status;
      let pushStatus = pushDelivery.status;

      if (emailStatus !== ShiftNotificationStatus.SENT && emailStatus !== ShiftNotificationStatus.SKIPPED) {
        const emailResult = await sendShiftReminderEmail(freshShift as any);
        emailStatus = emailResult.status === "SENT" ? ShiftNotificationStatus.SENT : ShiftNotificationStatus.SKIPPED;
        await prisma.shiftNotificationDelivery.update({
          where: { id: emailDelivery.id },
          data: {
            status: emailStatus,
            sentAt: emailStatus === ShiftNotificationStatus.SENT ? now : null,
            providerMessageId: emailResult.providerMessageId,
            errorMessage: emailResult.errorMessage
          }
        });
      }

      if (pushStatus !== ShiftNotificationStatus.SENT && pushStatus !== ShiftNotificationStatus.SKIPPED) {
        const subscriptions = await prisma.pushSubscription.findMany({
          where: {
            tenantId: freshShift.tenantId,
            userId: freshShift.workerId
          },
          select: {
            endpoint: true,
            p256dh: true,
            authSecret: true
          }
        });

        const pushResult = await sendShiftBrowserNotification(freshShift as any, subscriptions);
        pushStatus = pushResult.status === "SENT" ? ShiftNotificationStatus.SENT : ShiftNotificationStatus.SKIPPED;

        if (pushResult.expiredEndpoints.length) {
          await prisma.pushSubscription.deleteMany({
            where: {
              endpoint: { in: pushResult.expiredEndpoints }
            }
          });
        }

        await prisma.shiftNotificationDelivery.update({
          where: { id: pushDelivery.id },
          data: {
            status: pushStatus,
            sentAt: pushStatus === ShiftNotificationStatus.SENT ? now : null,
            providerMessageId: pushResult.providerMessageId,
            errorMessage: pushResult.errorMessage
          }
        });
      }

      if (emailStatus === ShiftNotificationStatus.SENT && [ShiftNotificationStatus.SENT, ShiftNotificationStatus.SKIPPED].includes(pushStatus)) {
        await prisma.shift.update({
          where: { id: freshShift.id },
          data: {
            notificationSent: true,
            notificationSentAt: now
          }
        });
        result.notified += 1;
      } else {
        result.failed += 1;
      }
    } catch (error: any) {
      result.failed += 1;
      console.error("shift reminder runner failed", error);
    } finally {
      await releaseShiftLock(prisma, shift.id);
    }
  }

  return result;
}
