import { PrismaClient, ShiftSourceType, ShiftStatus } from "@prisma/client";
import { DateTime } from "luxon";
import { deriveDayOfWeek, deriveWeekMetadata, computeShiftTimes, SHIFT_TIMEZONE } from "../src/lib/shifts/time";
import { runShiftReminderDispatch } from "../src/lib/shift-reminders/runner";

const prisma = new PrismaClient();

const tenantId = process.env.SMOKE_TENANT_ID ?? "acme-corp";
const adminEmail = process.env.SMOKE_ADMIN_EMAIL ?? "alice@acme.com";
const employeeEmail = process.env.SMOKE_EMPLOYEE_EMAIL ?? "lexmacsithmira@gmail.com";

async function main() {
  const admin = await prisma.user.findFirst({
    where: {
      tenantId,
      email: adminEmail,
      role: "COMPANY_ADMIN",
      status: "ACTIVE"
    }
  });

  if (!admin) {
    throw new Error(`Smoke test failed: admin not found (${adminEmail}) in tenant ${tenantId}`);
  }

  const employee = await prisma.user.findFirst({
    where: {
      tenantId,
      email: employeeEmail,
      role: "EMPLOYEE",
      status: "ACTIVE"
    }
  });

  if (!employee) {
    throw new Error(`Smoke test failed: employee not found (${employeeEmail}) in tenant ${tenantId}`);
  }

  await prisma.shiftReminderSetting.upsert({
    where: { tenantId },
    create: { tenantId, emailRemindersEnabled: true },
    update: { emailRemindersEnabled: true }
  });

  const nowLocal = DateTime.now().setZone(SHIFT_TIMEZONE);
  const date = nowLocal.toISODate();
  if (!date) {
    throw new Error("Smoke test failed: could not derive local date");
  }

  const startTime = nowLocal.plus({ minutes: 20 }).toFormat("HH:mm");
  const endTime = nowLocal.plus({ minutes: 80 }).toFormat("HH:mm");
  const weekMeta = deriveWeekMetadata(date);
  const times = computeShiftTimes(date, startTime, endTime, false);

  const shift = await prisma.shift.create({
    data: {
      tenantId,
      workerId: employee.id,
      createdById: admin.id,
      weekRange: weekMeta.weekRange,
      weekStartDate: weekMeta.weekStartDate,
      weekEndDate: weekMeta.weekEndDate,
      date,
      dayOfWeek: deriveDayOfWeek(date),
      location: "SMOKE_TEST",
      startTime,
      endTime,
      shiftStartAtUtc: times.shiftStartAtUtc,
      shiftEndAtUtc: times.shiftEndAtUtc,
      reminderDueAtUtc: times.reminderDueAtUtc,
      isDayOff: false,
      notificationSent: false,
      sourceType: ShiftSourceType.MANUAL,
      sourceFileName: "reminder-smoke",
      status: ShiftStatus.ACTIVE
    }
  });

  const result = await runShiftReminderDispatch(prisma);

  const notification = await prisma.notification.findFirst({
    where: {
      tenantId,
      userId: employee.id,
      shiftId: shift.id
    },
    orderBy: { createdAt: "desc" }
  });

  const ok = Boolean(notification);

  await prisma.notification.deleteMany({
    where: {
      tenantId,
      shiftId: shift.id
    }
  });

  await prisma.shiftNotificationDelivery.deleteMany({
    where: {
      tenantId,
      shiftId: shift.id
    }
  });

  await prisma.shift.delete({ where: { id: shift.id } });

  if (!ok) {
    throw new Error("Smoke test failed: reminder dispatch did not create notification record");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        tenantId,
        employeeEmail,
        result,
        verified: {
          notificationCreated: true
        }
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
