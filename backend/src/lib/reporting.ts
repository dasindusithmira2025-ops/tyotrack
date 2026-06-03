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

function numericValue(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function roundHours(value: number): number {
  return Number(value.toFixed(2));
}

export function aggregateReport(items: ReportItem[]): ReportTotals {
  return items.reduce<ReportTotals>(
    (acc, item) => {
      acc.totalHours = roundHours(acc.totalHours + numericValue(item.totalHoursSummed ?? item.totalHours));
      acc.eveningHours = roundHours(acc.eveningHours + numericValue(item.eveningHoursSummed ?? item.eveningHours));
      acc.nightHours = roundHours(acc.nightHours + numericValue(item.nightHoursSummed ?? item.nightHours));
      return acc;
    },
    { totalHours: 0, eveningHours: 0, nightHours: 0 }
  );
}

export function formatDailyEmployeeSummaryRows(
  groups: DailyEmployeeSummaryGroup[],
  users: ReportUser[]
) {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const rowsByDayAndUser = new Map<
    string,
    {
      date: string;
      userId: string;
      totalHoursSummed: number;
      eveningHoursSummed: number;
      nightHoursSummed: number;
    }
  >();

  groups.forEach((group) => {
    const userId = group.userId ?? "";
    const date = group.localDate ?? "";
    const key = `${date || "unknown-date"}:${userId || "unknown-user"}`;
    const existing = rowsByDayAndUser.get(key) ?? {
      date,
      userId,
      totalHoursSummed: 0,
      eveningHoursSummed: 0,
      nightHoursSummed: 0
    };

    existing.totalHoursSummed = roundHours(existing.totalHoursSummed + numericValue(group._sum.totalHours));
    existing.eveningHoursSummed = roundHours(existing.eveningHoursSummed + numericValue(group._sum.eveningHours));
    existing.nightHoursSummed = roundHours(existing.nightHoursSummed + numericValue(group._sum.nightHours));
    rowsByDayAndUser.set(key, existing);
  });

  return Array.from(rowsByDayAndUser.values()).map((row) => {
    const user = row.userId ? usersById.get(row.userId) : undefined;
    return {
      id: `${row.date || "unknown-date"}:${row.userId || "unknown-user"}`,
      date: row.date,
      userId: row.userId,
      totalHours: row.totalHoursSummed,
      eveningHours: row.eveningHoursSummed,
      nightHours: row.nightHoursSummed,
      totalHoursSummed: row.totalHoursSummed,
      eveningHoursSummed: row.eveningHoursSummed,
      nightHoursSummed: row.nightHoursSummed,
      user: {
        id: row.userId,
        name: user?.name?.trim() || "Unknown Employee",
        email: user?.email?.trim() || ""
      }
    };
  });
}
