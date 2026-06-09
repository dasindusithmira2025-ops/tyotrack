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

export interface IndividualEmployeeReportItem {
  id: string;
  localDate: string;
  userId: string;
  projectId: string;
  startTime: Date | string;
  endTime: Date | string;
  totalHours?: number | null;
  eveningHours?: number | null;
  nightHours?: number | null;
  workspaceId?: string | null;
  workspaceName?: string | null;
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
  project: {
    id: string;
    name?: string | null;
    workspace?: {
      id: string;
      name?: string | null;
    } | null;
  };
}

export interface IndividualEmployeeReportRow {
  id: string;
  date: string;
  userId: string;
  projectId: string;
  projectName: string;
  locationId: string;
  locationName: string;
  startTime: string;
  endTime: string;
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

export function formatIndividualEmployeeReportRows(
  items: IndividualEmployeeReportItem[]
): IndividualEmployeeReportRow[] {
  const dailyTotals = new Map<string, ReportTotals>();
  items.forEach((item) => {
    const key = `${item.localDate}:${item.userId}`;
    const existing = dailyTotals.get(key) ?? { totalHours: 0, eveningHours: 0, nightHours: 0 };
    existing.totalHours = roundHours(existing.totalHours + numericValue(item.totalHours));
    existing.eveningHours = roundHours(existing.eveningHours + numericValue(item.eveningHours));
    existing.nightHours = roundHours(existing.nightHours + numericValue(item.nightHours));
    dailyTotals.set(key, existing);
  });

  return items.map((item) => {
    const summed = dailyTotals.get(`${item.localDate}:${item.userId}`) ?? {
      totalHours: 0,
      eveningHours: 0,
      nightHours: 0
    };

    return {
      id: item.id,
      date: item.localDate,
      userId: item.userId,
      projectId: item.projectId,
      projectName: item.project.name?.trim() || "Unknown Project",
      locationId: item.workspaceId ?? item.project.workspace?.id ?? "unassigned-location",
      locationName: item.workspaceName?.trim()
        || item.project.workspace?.name?.trim()
        || "Unassigned Location",
      startTime: new Date(item.startTime).toISOString(),
      endTime: new Date(item.endTime).toISOString(),
      totalHours: numericValue(item.totalHours),
      eveningHours: numericValue(item.eveningHours),
      nightHours: numericValue(item.nightHours),
      totalHoursSummed: summed.totalHours,
      eveningHoursSummed: summed.eveningHours,
      nightHoursSummed: summed.nightHours,
      user: {
        id: item.userId,
        name: item.user.name?.trim() || "Unknown Employee",
        email: item.user.email?.trim() || ""
      }
    };
  });
}
