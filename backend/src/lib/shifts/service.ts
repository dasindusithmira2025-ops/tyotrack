import { Prisma, PrismaClient, ShiftSourceType, ShiftStatus, UserRole } from "@prisma/client";
import { ApiError } from "@/lib/http";
import { resolveTenant, type SessionToken } from "@/lib/auth-guard";
import { deriveDayOfWeek, deriveWeekMetadata, computeShiftTimes, buildWeekWindow } from "./time";
import type { ShiftCreateInput, ShiftImportPreviewRowInput, ShiftUpdateInput } from "./schemas";

const shiftInclude = {
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
  deliveries: {
    select: {
      channel: true,
      status: true,
      sentAt: true,
      errorMessage: true
    }
  }
} satisfies Prisma.ShiftInclude;

export type ShiftRecord = Prisma.ShiftGetPayload<{ include: typeof shiftInclude }>;

export function formatShift(shift: ShiftRecord) {
  return {
    id: shift.id,
    tenantId: shift.tenantId,
    workerId: shift.workerId,
    workerName: shift.worker.name,
    workerEmail: shift.worker.email,
    createdById: shift.createdById,
    weekRange: shift.weekRange,
    weekStartDate: shift.weekStartDate,
    weekEndDate: shift.weekEndDate,
    date: shift.date,
    dayOfWeek: shift.dayOfWeek,
    location: shift.location,
    startTime: shift.startTime,
    endTime: shift.endTime,
    isDayOff: shift.isDayOff,
    notificationSent: shift.notificationSent,
    notificationSentAt: shift.notificationSentAt?.toISOString() ?? null,
    status: shift.status,
    sourceType: shift.sourceType,
    sourceFileName: shift.sourceFileName,
    sourceRowNumber: shift.sourceRowNumber,
    shiftStartAtUtc: shift.shiftStartAtUtc?.toISOString() ?? null,
    shiftEndAtUtc: shift.shiftEndAtUtc?.toISOString() ?? null,
    reminderDueAtUtc: shift.reminderDueAtUtc?.toISOString() ?? null,
    createdAt: shift.createdAt.toISOString(),
    updatedAt: shift.updatedAt.toISOString(),
    deliveries: shift.deliveries.map((delivery) => ({
      channel: delivery.channel,
      status: delivery.status,
      sentAt: delivery.sentAt?.toISOString() ?? null,
      errorMessage: delivery.errorMessage ?? null
    }))
  };
}

async function assertWorker(prisma: PrismaClient, tenantId: string, workerId: string) {
  const worker = await prisma.user.findFirst({
    where: {
      id: workerId,
      tenantId,
      role: UserRole.EMPLOYEE,
      status: "ACTIVE"
    },
    select: {
      id: true,
      name: true,
      email: true
    }
  });

  if (!worker) {
    throw new ApiError(404, "Employee not found in this company");
  }

  return worker;
}

function buildShiftData(input: ShiftCreateInput | ShiftImportPreviewRowInput, tenantId: string, createdById: string) {
  const weekMeta = deriveWeekMetadata(input.date);
  const times = computeShiftTimes(input.date, input.startTime, input.endTime, input.isDayOff);

  return {
    tenantId,
    workerId: input.workerId,
    createdById,
    weekRange: input.weekRange?.trim() || weekMeta.weekRange,
    weekStartDate: weekMeta.weekStartDate,
    weekEndDate: weekMeta.weekEndDate,
    date: input.date,
    dayOfWeek: input.dayOfWeek?.trim() || deriveDayOfWeek(input.date),
    location: input.location?.trim() || null,
    startTime: input.isDayOff ? null : input.startTime?.trim() || null,
    endTime: input.isDayOff ? null : input.endTime?.trim() || null,
    shiftStartAtUtc: times.shiftStartAtUtc,
    shiftEndAtUtc: times.shiftEndAtUtc,
    reminderDueAtUtc: times.reminderDueAtUtc,
    isDayOff: input.isDayOff,
    notificationSent: false,
    notificationSentAt: null,
    sourceType: input.sourceType ?? ShiftSourceType.MANUAL,
    sourceFileName: input.sourceFileName?.trim() || null,
    sourceRowNumber: input.sourceRowNumber ?? null,
    status: ShiftStatus.ACTIVE
  };
}

export async function createShift(prisma: PrismaClient, session: SessionToken, input: ShiftCreateInput) {
  const tenantId = resolveTenant(session, input.tenantId);
  await assertWorker(prisma, tenantId, input.workerId);

  const created = await prisma.shift.create({
    data: buildShiftData(input, tenantId, session.sub),
    include: shiftInclude
  });

  return created;
}

export async function updateShift(prisma: PrismaClient, session: SessionToken, shiftId: string, input: ShiftUpdateInput) {
  const existing = await prisma.shift.findUnique({ where: { id: shiftId }, include: shiftInclude });
  if (!existing) {
    throw new ApiError(404, "Shift not found");
  }

  const tenantId = resolveTenant(session, existing.tenantId);

  if (existing.status === ShiftStatus.DELETED) {
    throw new ApiError(400, "Deleted shifts cannot be edited");
  }

  const workerId = input.workerId ?? existing.workerId;
  await assertWorker(prisma, tenantId, workerId);

  const hydrated = buildShiftData(
    {
      workerId,
      weekRange: input.weekRange ?? existing.weekRange,
      date: input.date ?? existing.date,
      dayOfWeek: input.dayOfWeek ?? existing.dayOfWeek,
      location: input.location ?? existing.location,
      startTime: input.startTime ?? existing.startTime,
      endTime: input.endTime ?? existing.endTime,
      isDayOff: input.isDayOff ?? existing.isDayOff,
      sourceType: existing.sourceType,
      sourceFileName: input.sourceFileName ?? existing.sourceFileName,
      sourceRowNumber: input.sourceRowNumber ?? existing.sourceRowNumber
    },
    tenantId,
    existing.createdById
  );

  const updated = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      ...hydrated,
      workerId,
      status: input.status ?? existing.status,
      createdById: existing.createdById,
      notificationSent: input.date || input.startTime || input.endTime || input.isDayOff !== undefined ? false : existing.notificationSent,
      notificationSentAt: input.date || input.startTime || input.endTime || input.isDayOff !== undefined ? null : existing.notificationSentAt
    },
    include: shiftInclude
  });

  return updated;
}

export async function softDeleteShift(prisma: PrismaClient, session: SessionToken, shiftId: string) {
  const existing = await prisma.shift.findUnique({ where: { id: shiftId }, include: shiftInclude });
  if (!existing) {
    throw new ApiError(404, "Shift not found");
  }

  resolveTenant(session, existing.tenantId);

  return prisma.shift.update({
    where: { id: shiftId },
    data: { status: ShiftStatus.DELETED },
    include: shiftInclude
  });
}

export async function listShifts(
  prisma: PrismaClient,
  session: SessionToken,
  filters: {
    tenantId?: string;
    workerId?: string;
    startDate?: string;
    endDate?: string;
    status?: ShiftStatus;
    includeDeleted?: boolean;
    upcomingOnly?: boolean;
  }
) {
  const tenantId = resolveTenant(session, filters.tenantId);
  const workerId = session.role === UserRole.EMPLOYEE ? session.sub : filters.workerId;
  const upcomingWindow = filters.upcomingOnly ? buildWeekWindow() : null;
  const startDate = filters.startDate ?? upcomingWindow?.startDate;
  const endDate = filters.endDate ?? upcomingWindow?.endDate;

  const records = await prisma.shift.findMany({
    where: {
      tenantId,
      ...(workerId ? { workerId } : {}),
      ...(filters.includeDeleted ? {} : { status: filters.status ?? ShiftStatus.ACTIVE }),
      ...(startDate || endDate
        ? {
            date: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {})
            }
          }
        : {})
    },
    include: shiftInclude,
    orderBy: [{ date: "asc" }, { startTime: "asc" }]
  });

  return records;
}

export async function getShift(prisma: PrismaClient, session: SessionToken, shiftId: string) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: shiftInclude
  });

  if (!shift) {
    throw new ApiError(404, "Shift not found");
  }

  resolveTenant(session, shift.tenantId);
  if (session.role === UserRole.EMPLOYEE && shift.workerId !== session.sub) {
    throw new ApiError(403, "Forbidden");
  }

  return shift;
}

export async function createImportedShifts(
  prisma: PrismaClient,
  session: SessionToken,
  tenantIdInput: string | undefined,
  fileName: string | null | undefined,
  rows: ShiftImportPreviewRowInput[]
) {
  const tenantId = resolveTenant(session, tenantIdInput);

  for (const row of rows) {
    await assertWorker(prisma, tenantId, row.workerId);
  }

  return prisma.$transaction(
    rows.map((row) =>
      prisma.shift.create({
        data: buildShiftData(
          {
            ...row,
            sourceType: ShiftSourceType.IMPORT,
            sourceFileName: fileName ?? row.sourceFileName ?? null
          },
          tenantId,
          session.sub
        ),
        include: shiftInclude
      })
    )
  );
}

