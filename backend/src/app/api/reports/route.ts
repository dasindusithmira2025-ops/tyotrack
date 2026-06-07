import { NextRequest } from "next/server";
import { requireAuth, resolveTenant } from "@/lib/auth-guard";
import { ApiError, jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { aggregateReport, formatDailyEmployeeSummaryRows } from "@/lib/reporting";
import { buildEmployeeHoursWorkbook } from "@/lib/report-export";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    const tenantId = resolveTenant(session, req.nextUrl.searchParams.get("tenantId"));
    const startDate = req.nextUrl.searchParams.get("startDate");
    const endDate = req.nextUrl.searchParams.get("endDate");
    const requestedUserId = req.nextUrl.searchParams.get("userId");
    const format = req.nextUrl.searchParams.get("format");

    if (!startDate || !endDate) {
      throw new ApiError(400, "startDate and endDate are required");
    }

    const userId = session.role === "EMPLOYEE" ? session.sub : requestedUserId;

    const groups = await prisma.timeEntrySplit.groupBy({
      by: ["localDate", "userId", "projectId", "timeEntryId"],
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
      orderBy: [{ localDate: "desc" }, { userId: "asc" }, { projectId: "asc" }, { timeEntryId: "asc" }]
    });

    const userIds = [...new Set(groups.map((group) => group.userId).filter(Boolean))];
    const projectIds = [...new Set(groups.map((group) => group.projectId).filter(Boolean))];
    const timeEntryIds = [...new Set(groups.map((group) => group.timeEntryId).filter(Boolean))];
    const [users, projects, timeEntries] = await Promise.all([
      userIds.length
        ? prisma.user.findMany({
          where: {
            id: { in: userIds },
            tenantId
          },
          select: { id: true, name: true, email: true }
        })
        : [],
      projectIds.length
        ? prisma.project.findMany({
            where: {
              id: { in: projectIds },
              tenantId
            },
            select: {
              id: true,
              name: true,
              workspace: { select: { id: true, name: true } }
            }
          })
        : [],
      timeEntryIds.length
        ? prisma.timeEntry.findMany({
            where: {
              id: { in: timeEntryIds },
              tenantId
            },
            select: {
              id: true,
              workspace: { select: { id: true, name: true } }
            }
          })
        : []
    ]);
    const workspaceByTimeEntryId = new Map(timeEntries.map((entry) => [entry.id, entry.workspace]));
    const rows = formatDailyEmployeeSummaryRows(
      groups.map((group) => {
        const workspace = workspaceByTimeEntryId.get(group.timeEntryId);
        return {
          ...group,
          workspaceId: workspace?.id ?? null,
          workspaceName: workspace?.name ?? null
        };
      }),
      users,
      projects
    );
    const totals = aggregateReport(rows);

    if (format === "xlsx") {
      const filename = `employee-hours_${startDate}_to_${endDate}.xlsx`;
      const workbook = buildEmployeeHoursWorkbook(rows);
      return new Response(workbook, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(workbook.length),
          "Cache-Control": "no-store"
        }
      });
    }

    return jsonOk({
      totals,
      rows
    });
  } catch (error) {
    return jsonError(error);
  }
}
