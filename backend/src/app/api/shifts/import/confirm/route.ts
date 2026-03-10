import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireAuth, requireRoles } from "@/lib/auth-guard";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { shiftImportConfirmSchema } from "@/lib/shifts/schemas";
import { createImportedShifts, formatShift } from "@/lib/shifts/service";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    requireRoles(session, [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN]);

    const body = shiftImportConfirmSchema.parse(await req.json());
    const created = await createImportedShifts(prisma, session, body.tenantId, body.fileName, body.rows);

    if (created.length) {
      await logAudit(prisma, {
        tenantId: created[0].tenantId,
        userId: session.sub,
        action: "SHIFT_IMPORT_CONFIRM",
        entity: "Shift",
        entityId: null,
        details: {
          fileName: body.fileName,
          count: created.length,
          rowNumbers: created.map((shift) => shift.sourceRowNumber)
        }
      });
    }

    return jsonOk(created.map(formatShift), 201);
  } catch (error) {
    return jsonError(error);
  }
}

