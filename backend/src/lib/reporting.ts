interface ReportItem {
  totalHours?: number | null;
  eveningHours?: number | null;
  nightHours?: number | null;
  totalHoursSummed?: number | null;
  eveningHoursSummed?: number | null;
  nightHoursSummed?: number | null;
}

interface ReportTotals {
  totalHours: number;
  eveningHours: number;
  nightHours: number;
}

export interface DailyEmployeeSummaryGroup {
  localDate: string | null;
  userId: string | null;
  projectId: string | null;
  workspaceId?: string | null;
  workspaceName?: string | null;
  _sum: {
    totalHours?: number | null;
    eveningHours?: number | null;
    nightHours?: number | null;
  };
}

export interface ReportUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

export interface ReportProject {
  id: string;
  name?: string | null;
  workspace?: {
    id: string;
    name?: string | null;
  } | null;
}

export interface DailyEmployeeSummaryRow {
  id: string;
  date: string;
  userId: string;
  locationId: string;
  locationName: string;
  totalHours: number;
  eveningHours: number;
  nightHours: number;
  totalHoursSummed: number;
  eveningHoursSummed: number;
  nightHoursSummed: number;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

function numericValue(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function roundHours(value: number): number {
  return Number(value.toFixed(2));
}

export function aggregateReport(items: ReportItem[]): ReportTotals {
  return items.reduce<ReportTotals>(
    (acc, item) => {
      acc.totalHours = roundHours(acc.totalHours + numericValue(item.totalHours));
      acc.eveningHours = roundHours(acc.eveningHours + numericValue(item.eveningHours));
      acc.nightHours = roundHours(acc.nightHours + numericValue(item.nightHours));
      return acc;
    },
    { totalHours: 0, eveningHours: 0, nightHours: 0 }
  );
}

export function formatDailyEmployeeSummaryRows(
  groups: DailyEmployeeSummaryGroup[],
  users: ReportUser[],
  projects: ReportProject[]
): DailyEmployeeSummaryRow[] {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const rowsByDayUserAndLocation = new Map<
    string,
    {
      date: string;
      userId: string;
      locationId: string;
      locationName: string;
      totalHours: number;
      eveningHours: number;
      nightHours: number;
    }
  >();

  groups.forEach((group) => {
    const userId = group.userId ?? "";
    const date = group.localDate ?? "";
    const project = group.projectId ? projectsById.get(group.projectId) : undefined;
    const locationId = group.workspaceId
      ?? project?.workspace?.id
      ?? (group.projectId ? `project:${group.projectId}` : "unassigned-location");
    const locationName = group.workspaceName?.trim()
      || project?.workspace?.name?.trim()
      || project?.name?.trim()
      || "Unassigned Location";
    const key = `${date || "unknown-date"}:${userId || "unknown-user"}:${locationId}`;
    const existing = rowsByDayUserAndLocation.get(key) ?? {
      date,
      userId,
      locationId,
      locationName,
      totalHours: 0,
      eveningHours: 0,
      nightHours: 0
    };

    existing.totalHours = roundHours(existing.totalHours + numericValue(group._sum.totalHours));
    existing.eveningHours = roundHours(existing.eveningHours + numericValue(group._sum.eveningHours));
    existing.nightHours = roundHours(existing.nightHours + numericValue(group._sum.nightHours));
    rowsByDayUserAndLocation.set(key, existing);
  });

  const dailyTotals = new Map<string, ReportTotals>();
  rowsByDayUserAndLocation.forEach((row) => {
    const key = `${row.date || "unknown-date"}:${row.userId || "unknown-user"}`;
    const existing = dailyTotals.get(key) ?? { totalHours: 0, eveningHours: 0, nightHours: 0 };
    existing.totalHours = roundHours(existing.totalHours + row.totalHours);
    existing.eveningHours = roundHours(existing.eveningHours + row.eveningHours);
    existing.nightHours = roundHours(existing.nightHours + row.nightHours);
    dailyTotals.set(key, existing);
  });

  return Array.from(rowsByDayUserAndLocation.values()).map((row) => {
    const user = row.userId ? usersById.get(row.userId) : undefined;
    const summed = dailyTotals.get(`${row.date || "unknown-date"}:${row.userId || "unknown-user"}`) ?? {
      totalHours: 0,
      eveningHours: 0,
      nightHours: 0
    };

    return {
      id: `${row.date || "unknown-date"}:${row.userId || "unknown-user"}:${row.locationId}`,
      date: row.date,
      userId: row.userId,
      locationId: row.locationId,
      locationName: row.locationName,
      totalHours: row.totalHours,
      eveningHours: row.eveningHours,
      nightHours: row.nightHours,
      totalHoursSummed: summed.totalHours,
      eveningHoursSummed: summed.eveningHours,
      nightHoursSummed: summed.nightHours,
      user: {
        id: row.userId,
        name: user?.name?.trim() || "Unknown Employee",
        email: user?.email?.trim() || ""
      }
    };
  });
}
