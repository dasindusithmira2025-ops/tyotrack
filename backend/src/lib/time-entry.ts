import { DateTime } from "luxon";
import { EntryStatus, PrismaClient, UserRole } from "@prisma/client";
import { ApiError } from "@/lib/http";

const HELSINKI_TZ = "Europe/Helsinki";

export interface PolicyConfig {
  eveningStart: string;
  eveningEnd: string;
  nightStart: string;
  nightEnd: string;
}

export interface CreateTimeEntryParams {
  prisma: PrismaClient;
  tenantId: string;
  actorId: string;
  actorRole: UserRole;
  userId: string;
  projectId: string;
  workspaceId?: string | null;
  startTime: string;
  endTime: string;
  notes?: string;
}

export function getInitialEntryStatus(autoApproveEntries: boolean): EntryStatus {
  return autoApproveEntries ? EntryStatus.APPROVED : EntryStatus.PENDING;
}

export function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new ApiError(400, "Time values must be in 24-hour HH:mm format");
  }
  return hours * 60 + minutes;
}

export function calculateOverlapHours(
  segmentStartMinutes: number,
  segmentEndMinutes: number,
  shiftStartMinutes: number,
  shiftEndMinutes: number
): number {
  let overlap = 0;

  if (shiftStartMinutes < shiftEndMinutes) {
    const start = Math.max(segmentStartMinutes, shiftStartMinutes);
    const end = Math.min(segmentEndMinutes, shiftEndMinutes);
    if (start < end) {
      overlap += end - start;
    }
  } else {
    const start1 = Math.max(segmentStartMinutes, shiftStartMinutes);
    const end1 = Math.min(segmentEndMinutes, 1440);
    if (start1 < end1) {
      overlap += end1 - start1;
    }

    const start2 = Math.max(segmentStartMinutes, 0);
    const end2 = Math.min(segmentEndMinutes, shiftEndMinutes);
    if (start2 < end2) {
      overlap += end2 - start2;
    }
  }

  return Number((overlap / 60).toFixed(2));
}

interface SplitSegment {
  startUtc: Date;
  endUtc: Date;
  localDate: string;
}

export function splitByMidnightHelsinki(startUtc: Date, endUtc: Date): SplitSegment[] {
  const start = DateTime.fromJSDate(startUtc, { zone: "utc" }).setZone(HELSINKI_TZ);
  const end = DateTime.fromJSDate(endUtc, { zone: "utc" }).setZone(HELSINKI_TZ);

  if (end <= start) {
    throw new ApiError(400, "End time must be after start time");
  }

  const splits: SplitSegment[] = [];
  let cursor = start;

  while (cursor < end) {
    const midnight = cursor.plus({ days: 1 }).startOf("day");
    const segmentEnd = midnight < end ? midnight : end;

    splits.push({
      startUtc: cursor.toUTC().toJSDate(),
      endUtc: segmentEnd.toUTC().toJSDate(),
      localDate: cursor.toISODate() as string
    });

    cursor = segmentEnd;
  }

  return splits;
}

function validateBackdateOrFuture(localDate: string, limitDays: number): void {
  const today = DateTime.now().setZone(HELSINKI_TZ).startOf("day");
  const entryDate = DateTime.fromISO(localDate, { zone: HELSINKI_TZ }).startOf("day");

  if (entryDate > today) {
    throw new ApiError(400, "Cannot create time entries for future dates");
  }

  const diff = Math.floor(today.diff(entryDate, "days").days);
  if (diff > limitDays) {
    throw new ApiError(400, `Cannot create entries older than ${limitDays} days`);
  }
}

export function summarizeSplit(segment: SplitSegment, policy: PolicyConfig) {
  const startLocal = DateTime.fromJSDate(segment.startUtc, { zone: "utc" }).setZone(HELSINKI_TZ);
  const endLocal = DateTime.fromJSDate(segment.endUtc, { zone: "utc" }).setZone(HELSINKI_TZ);

  const startMinutes = startLocal.hour * 60 + startLocal.minute;
  let endMinutes = endLocal.hour * 60 + endLocal.minute;

  // If a segment ends exactly at next-day midnight, represent it as 24:00 for overlap math.
  if (endMinutes === 0 && endLocal.toISODate() !== startLocal.toISODate()) {
    endMinutes = 1440;
  }

  const totalHours = Number((endLocal.diff(startLocal, "minutes").minutes / 60).toFixed(2));

  const eveningHours = calculateOverlapHours(
    startMinutes,
    endMinutes,
    parseTimeToMinutes(policy.eveningStart),
    parseTimeToMinutes(policy.eveningEnd)
  );

  const nightHours = calculateOverlapHours(
    startMinutes,
    endMinutes,
    parseTimeToMinutes(policy.nightStart),
    parseTimeToMinutes(policy.nightEnd)
  );

  return { totalHours, eveningHours, nightHours };
}

export async function createTimeEntryWithSplits(params: CreateTimeEntryParams) {
  const startUtc = new Date(params.startTime);
  const endUtc = new Date(params.endTime);

  if (Number.isNaN(startUtc.getTime()) || Number.isNaN(endUtc.getTime())) {
    throw new ApiError(400, "Invalid date input");
  }

  const [user, policy, project] = await Promise.all([
    params.prisma.user.findUnique({ where: { id: params.userId } }),
    params.prisma.policy.findFirst({ where: { tenantId: params.tenantId, isActive: true }, orderBy: { effectiveFrom: "desc" } }),
    params.prisma.project.findFirst({ where: { id: params.projectId, tenantId: params.tenantId } })
  ]);

  if (!user || user.status !== "ACTIVE") {
    throw new ApiError(404, "User not found or inactive");
  }

  if (!user.tenantId || user.tenantId !== params.tenantId) {
    throw new ApiError(403, "User does not belong to this tenant");
  }

  if (!project || project.status !== "ACTIVE") {
    throw new ApiError(404, "Project not found or inactive");
  }

  if (user.role === "EMPLOYEE") {
    const assignment = await params.prisma.projectAssignment.findFirst({
      where: {
        tenantId: params.tenantId,
        projectId: params.projectId,
        userId: params.userId
      },
      select: { id: true }
    });

    if (!assignment) {
      throw new ApiError(403, "This employee is not assigned to the selected project");
    }
  }

  if (params.actorRole !== "SUPER_ADMIN" && params.actorRole !== "COMPANY_ADMIN" && params.actorId !== params.userId) {
    throw new ApiError(403, "Employees can only create their own entries");
  }

  if (params.workspaceId && project.workspaceId && params.workspaceId !== project.workspaceId) {
    throw new ApiError(400, "Project is not linked to the selected workspace");
  }

  // Prevent employees from submitting overlapping time ranges.
  const overlappingEntry = await params.prisma.timeEntry.findFirst({
    where: {
      tenantId: params.tenantId,
      userId: params.userId,
      status: { not: EntryStatus.REJECTED },
      startTime: { lt: endUtc },
      endTime: { gt: startUtc }
    },
    select: {
      id: true,
      startTime: true,
      endTime: true
    }
  });

  if (overlappingEntry) {
    throw new ApiError(409, "Overlapping time entry already exists for this employee", {
      conflictingEntryId: overlappingEntry.id,
      conflictingStartTime: overlappingEntry.startTime.toISOString(),
      conflictingEndTime: overlappingEntry.endTime.toISOString()
    });
  }

  const resolvedWorkspaceId = params.workspaceId ?? project.workspaceId ?? null;

  if (resolvedWorkspaceId) {
    const workspace = await params.prisma.workspace.findFirst({
      where: { id: resolvedWorkspaceId, tenantId: params.tenantId }
    });

    if (!workspace || workspace.status !== "ACTIVE") {
      throw new ApiError(404, "Workspace not found or inactive");
    }
  }

  const activePolicy: PolicyConfig = {
    eveningStart: policy?.eveningStart ?? "18:00",
    eveningEnd: policy?.eveningEnd ?? "22:00",
    nightStart: policy?.nightStart ?? "22:00",
    nightEnd: policy?.nightEnd ?? "06:00"
  };

  const splits = splitByMidnightHelsinki(startUtc, endUtc);
  splits.forEach((segment) => validateBackdateOrFuture(segment.localDate, user.backdateLimitDays));

  const summaries = splits.map((segment) => ({
    segment,
    ...summarizeSplit(segment, activePolicy)
  }));

  const totalHours = Number(summaries.reduce((acc, item) => acc + item.totalHours, 0).toFixed(2));
  const eveningHours = Number(summaries.reduce((acc, item) => acc + item.eveningHours, 0).toFixed(2));
  const nightHours = Number(summaries.reduce((acc, item) => acc + item.nightHours, 0).toFixed(2));
  const initialStatus = getInitialEntryStatus(user.autoApproveEntries);
  const initialApprovedAt = initialStatus === EntryStatus.APPROVED ? new Date() : null;
  const initialApprovedById = initialStatus === EntryStatus.APPROVED ? params.actorId : null;

  return params.prisma.$transaction(async (tx) => {
    const entry = await tx.timeEntry.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        createdById: params.actorId,
        projectId: params.projectId,
        workspaceId: resolvedWorkspaceId,
        startTime: startUtc,
        endTime: endUtc,
        notes: params.notes,
        totalHours,
        eveningHours,
        nightHours,
        status: initialStatus,
        lockedAt: initialStatus === EntryStatus.APPROVED ? new Date() : null
      }
    });

    const createdSplits = [];

    for (const item of summaries) {
      const localDateStart = DateTime.fromISO(item.segment.localDate, { zone: HELSINKI_TZ }).startOf("day").toUTC().toJSDate();

      const split = await tx.timeEntrySplit.create({
        data: {
          tenantId: params.tenantId,
          timeEntryId: entry.id,
          userId: params.userId,
          projectId: params.projectId,
          date: localDateStart,
          localDate: item.segment.localDate,
          startTime: item.segment.startUtc,
          endTime: item.segment.endUtc,
          status: initialStatus,
          notes: params.notes,
          totalHours: item.totalHours,
          eveningHours: item.eveningHours,
          nightHours: item.nightHours,
          approvedById: initialApprovedById,
          approvedAt: initialApprovedAt
        }
      });

      createdSplits.push(split);
    }

    return { entry, splits: createdSplits };
  });
}

export function deriveParentStatus(statuses: EntryStatus[]): EntryStatus {
  if (statuses.every((status) => status === EntryStatus.APPROVED)) {
    return EntryStatus.APPROVED;
  }

  if (statuses.some((status) => status === EntryStatus.REJECTED)) {
    return EntryStatus.REJECTED;
  }

  return EntryStatus.PENDING;
}

export async function updateSplitStatus(params: {
  prisma: PrismaClient;
  splitId: string;
  status: EntryStatus;
  actorId: string;
  reason?: string;
}) {
  const existing = await params.prisma.timeEntrySplit.findUnique({
    where: { id: params.splitId },
    include: { timeEntry: true }
  });

  if (!existing) {
    throw new ApiError(404, "Time entry not found");
  }

  if (existing.status === EntryStatus.APPROVED && params.status !== EntryStatus.APPROVED) {
    throw new ApiError(409, "Approved entries are immutable");
  }

  return params.prisma.$transaction(async (tx) => {
    const updated = await tx.timeEntrySplit.update({
      where: { id: params.splitId },
      data: {
        status: params.status,
        approvedById: params.status === EntryStatus.APPROVED ? params.actorId : null,
        approvedAt: params.status === EntryStatus.APPROVED ? new Date() : null,
        rejectionReason: params.status === EntryStatus.REJECTED ? params.reason ?? "Rejected" : null
      }
    });

    const siblings = await tx.timeEntrySplit.findMany({
      where: { timeEntryId: existing.timeEntryId },
      select: { status: true }
    });

    const parentStatus = deriveParentStatus(siblings.map((item) => item.status));

    await tx.timeEntry.update({
      where: { id: existing.timeEntryId },
      data: {
        status: parentStatus,
        rejectionReason: parentStatus === EntryStatus.REJECTED ? params.reason ?? "Rejected" : null,
        lockedAt: parentStatus === EntryStatus.APPROVED ? new Date() : null
      }
    });

    return updated;
  });
}

export function formatSplitForFrontend(split: {
  id: string;
  userId: string;
  workspaceId?: string | null;
  projectId: string;
  startTime: Date;
  endTime: Date;
  status: EntryStatus;
  eveningHours: number;
  nightHours: number;
  totalHours: number;
  localDate: string;
  notes: string | null;
  rejectionReason: string | null;
}) {
  return {
    id: split.id,
    userId: split.userId,
    workspaceId: split.workspaceId ?? "",
    projectId: split.projectId,
    startTime: split.startTime.toISOString(),
    endTime: split.endTime.toISOString(),
    notes: split.notes ?? undefined,
    status: split.status,
    eveningHours: split.eveningHours,
    nightHours: split.nightHours,
    totalHours: split.totalHours,
    date: split.localDate,
    rejectionReason: split.rejectionReason ?? undefined
  };
}
