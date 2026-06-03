import { NextRequest } from "next/server";
import { requireAuth, resolveTenant } from "@/lib/auth-guard";
import { ApiError, jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { aggregateReport, formatDailyEmployeeSummaryRows } from "@/lib/reporting";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    const tenantId = resolveTenant(session, req.nextUrl.searchParams.get("tenantId"));
    const startDate = req.nextUrl.searchParams.get("startDate");
    const endDate = req.nextUrl.searchParams.get("endDate");
    const requestedUserId = req.nextUrl.searchParams.get("userId");

    if (!startDate || !endDate) {
      throw new ApiError(400, "startDate and endDate are required");
    }

    const userId = session.role === "EMPLOYEE" ? session.sub : requestedUserId;

    const groups = await prisma.timeEntrySplit.groupBy({
      by: ["localDate", "userId"],
      where: {
        tenantId,
        status: "APPROVED",
        localDate: {
          gte: startDate,
          lte: endDate
        },
        ...(userId ? { userId } : {})
      },
      _sum: {
        totalHours: true,
        eveningHours: true,
        nightHours: true
      },
      orderBy: [{ localDate: "desc" }, { userId: "asc" }]
    });

    const userIds = [...new Set(groups.map((group) => group.userId).filter(Boolean))];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: {
            id: { in: userIds },
            tenantId
          },
          select: { id: true, name: true, email: true }
        })
      : [];
    const rows = formatDailyEmployeeSummaryRows(groups, users);
    const totals = aggregateReport(rows);

    return jsonOk({
      totals,
      rows
    });
  } catch (error) {
    return jsonError(error);
  }
}
