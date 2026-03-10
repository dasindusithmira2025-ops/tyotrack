import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireAuth, requireRoles } from "@/lib/auth-guard";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getShift, formatShift, softDeleteShift, updateShift } from "@/lib/shifts/service";
import { shiftUpdateSchema } from "@/lib/shifts/schemas";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth(req);
    const { id } = await context.params;
    const shift = await getShift(prisma, session, id);
    return jsonOk(formatShift(shift));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth(req);
    requireRoles(session, [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN]);

    const { id } = await context.params;
    const body = shiftUpdateSchema.parse(await req.json());
    const updated = await updateShift(prisma, session, id, body);

    await logAudit(prisma, {
      tenantId: updated.tenantId,
      userId: session.sub,
      action: "SHIFT_UPDATE",
      entity: "Shift",
      entityId: updated.id,
      details: {
        workerId: updated.workerId,
        date: updated.date,
        status: updated.status
      }
    });

    return jsonOk(formatShift(updated));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth(req);
    requireRoles(session, [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN]);

    const { id } = await context.params;
    const deleted = await softDeleteShift(prisma, session, id);

    await logAudit(prisma, {
      tenantId: deleted.tenantId,
      userId: session.sub,
      action: "SHIFT_DELETE",
      entity: "Shift",
      entityId: deleted.id,
      details: {
        workerId: deleted.workerId,
        date: deleted.date,
        status: deleted.status
      }
    });

    return jsonOk({ id: deleted.id, status: deleted.status });
  } catch (error) {
    return jsonError(error);
  }
}

