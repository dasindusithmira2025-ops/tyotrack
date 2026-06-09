import { NextRequest } from "next/server";
import { requireAuth, resolveTenant } from "@/lib/auth-guard";
import { ApiError, jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { aggregateReport, formatIndividualEmployeeReportRows } from "@/lib/reporting";
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

    const splits = await prisma.timeEntrySplit.findMany({
      where: {
        tenantId,
        status: "APPROVED",
        localDate: {
          gte: startDate,
          lte: endDate
        },
        ...(userId ? { userId } : {})
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        project: {
          select: {
            id: true,
            name: true,
            workspace: {
              select: { id: true, name: true }
            }
          }
        },
        timeEntry: {
          select: {
            workspace: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: [{ localDate: "desc" }, { startTime: "desc" }, { userId: "asc" }]
    });

    const rows = formatIndividualEmployeeReportRows(splits.map((split) => ({
      ...split,
      workspaceId: split.timeEntry.workspace?.id ?? null,
      workspaceName: split.timeEntry.workspace?.name ?? null
    })));
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
