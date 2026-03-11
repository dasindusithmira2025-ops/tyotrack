import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireAuth, requireRoles } from "@/lib/auth-guard";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { shiftBulkDeleteSchema } from "@/lib/shifts/schemas";
import { softDeleteShiftsInRange } from "@/lib/shifts/service";

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    requireRoles(session, [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN]);

    const body = shiftBulkDeleteSchema.parse(await req.json());
    const result = await softDeleteShiftsInRange(prisma, session, body);

    await logAudit(prisma, {
      tenantId: result.tenantId,
      userId: session.sub,
      action: "SHIFT_BULK_DELETE",
      entity: "Shift",
      details: {
        workerId: result.workerId,
        startDate: result.startDate,
        endDate: result.endDate,
        affectedCount: result.affectedCount,
        endpoint: "/api/schedules/bulk-delete"
      }
    });

    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
