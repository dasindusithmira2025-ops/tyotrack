interface ReportItem {
  totalHours?: number | null;
  eveningHours?: number | null;
  nightHours?: number | null;
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
  users: ReportUser[]
) {
  const usersById = new Map(users.map((user) => [user.id, user]));

  return groups.map((group) => {
    const userId = group.userId ?? "";
    const user = userId ? usersById.get(userId) : undefined;
    const date = group.localDate ?? "";

    return {
      id: `${date || "unknown-date"}:${userId || "unknown-user"}`,
      date,
      userId,
      totalHours: roundHours(numericValue(group._sum.totalHours)),
      eveningHours: roundHours(numericValue(group._sum.eveningHours)),
      nightHours: roundHours(numericValue(group._sum.nightHours)),
      user: {
        id: userId,
        name: user?.name?.trim() || "Unknown Employee",
        email: user?.email?.trim() || ""
      }
    };
  });
}
