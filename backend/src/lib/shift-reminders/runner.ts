import { NotificationType, PrismaClient, ShiftNotificationChannel, ShiftNotificationStatus, ShiftStatus } from "@prisma/client";
import { DateTime } from "luxon";
import { SHIFT_TIMEZONE } from "@/lib/shifts/time";
import { sendShiftReminderEmail } from "./email";

interface ReminderRunResult {
  processed: number;
  notified: number;
  skipped: number;
  failed: number;
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

async function getRemindersEnabled(
  prisma: PrismaClient,
  tenantId: string,
  cache: Map<string, boolean>
): Promise<boolean> {
  if (cache.has(tenantId)) {
    return cache.get(tenantId) as boolean;
  }

  let enabled = true;
  try {
    const settings = await prisma.shiftReminderSetting.findUnique({
      where: { tenantId },
      select: { emailRemindersEnabled: true }
    });
    enabled = settings?.emailRemindersEnabled ?? true;
  } catch (error: any) {
    if (error?.code !== "P2021") {
      throw error;
    }

    console.warn("[shift-reminders] shift_reminder_settings table not found; defaulting reminders to enabled");
  }

  cache.set(tenantId, enabled);
  return enabled;
}

function buildReminderEventKey(shift: {
  id: string;
  reminderDueAtUtc: Date | null;
  shiftStartAtUtc: Date | null;
  date: string;
  startTime: string | null;
}): string {
  const scheduleVersion = shift.reminderDueAtUtc?.toISOString()
    ?? shift.shiftStartAtUtc?.toISOString()
    ?? `${shift.date}T${shift.startTime ?? "00:00"}`;

  return `shift-reminder:${shift.id}:${scheduleVersion}`;
}

function buildReminderMessage(shift: {
  dayOfWeek: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
}): string {
  return `${shift.dayOfWeek}, ${shift.date} - ${shift.location || "Unassigned"} - ${shift.startTime || "--:--"}-${shift.endTime || "--:--"}`;
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
      }
    },
    orderBy: {
      reminderDueAtUtc: "asc"
    }
  });

  const result: ReminderRunResult = { processed: 0, notified: 0, skipped: 0, failed: 0 };
  const tenantReminderToggleCache = new Map<string, boolean>();

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
          }
        }
      });

      if (!freshShift || freshShift.notificationSent || freshShift.status === ShiftStatus.DELETED) {
        result.skipped += 1;
        continue;
      }

      const remindersEnabled = await getRemindersEnabled(prisma, freshShift.tenantId, tenantReminderToggleCache);
      const emailDelivery = await upsertDelivery(prisma, freshShift.tenantId, freshShift.id, ShiftNotificationChannel.EMAIL);
      const pushDelivery = await upsertDelivery(prisma, freshShift.tenantId, freshShift.id, ShiftNotificationChannel.PUSH);

      if (!remindersEnabled) {
        await prisma.shiftNotificationDelivery.updateMany({
          where: { id: { in: [emailDelivery.id, pushDelivery.id] } },
          data: {
            status: ShiftNotificationStatus.SKIPPED,
            sentAt: null,
            providerMessageId: null,
            errorMessage: "1-hour reminders are disabled by admin setting"
          }
        });

        result.skipped += 1;
        continue;
      }

      const eventKey = buildReminderEventKey(freshShift);
      const notification = await prisma.notification.upsert({
        where: {
          eventKey
        },
        create: {
          tenantId: freshShift.tenantId,
          userId: freshShift.workerId,
          shiftId: freshShift.id,
          type: NotificationType.SHIFT_REMINDER,
          eventKey,
          title: "Shift starting in 1 hour",
          message: buildReminderMessage(freshShift),
          payload: {
            shiftId: freshShift.id,
            date: freshShift.date,
            dayOfWeek: freshShift.dayOfWeek,
            startTime: freshShift.startTime,
            endTime: freshShift.endTime,
            location: freshShift.location,
            route: "/#/my-shifts"
          }
        },
        update: {}
      });

      if (pushDelivery.status !== ShiftNotificationStatus.SENT) {
        await prisma.shiftNotificationDelivery.update({
          where: { id: pushDelivery.id },
          data: {
            status: ShiftNotificationStatus.SENT,
            sentAt: now,
            providerMessageId: `inhouse:${notification.id}`,
            errorMessage: null
          }
        });
      }

      let emailStatus = emailDelivery.status;
      if (emailStatus !== ShiftNotificationStatus.SENT) {
        const emailResult = await sendShiftReminderEmail({
          id: freshShift.id,
          date: freshShift.date,
          dayOfWeek: freshShift.dayOfWeek,
          location: freshShift.location,
          startTime: freshShift.startTime,
          endTime: freshShift.endTime,
          worker: {
            id: freshShift.worker.id,
            name: freshShift.worker.name,
            email: freshShift.worker.email
          }
        });

        emailStatus =
          emailResult.status === "SENT"
            ? ShiftNotificationStatus.SENT
            : emailResult.status === "SKIPPED"
              ? ShiftNotificationStatus.SKIPPED
              : ShiftNotificationStatus.FAILED;

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

      const emailCompleted = emailStatus === ShiftNotificationStatus.SENT || emailStatus === ShiftNotificationStatus.SKIPPED;

      if (emailCompleted) {
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

