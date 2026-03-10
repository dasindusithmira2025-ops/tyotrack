import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireAuth, requireRoles } from "@/lib/auth-guard";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { shiftCreateSchema, shiftListSchema } from "@/lib/shifts/schemas";
import { createShift, formatShift, listShifts } from "@/lib/shifts/service";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const filters = shiftListSchema.parse({
      tenantId: req.nextUrl.searchParams.get("tenantId") ?? undefined,
      workerId: req.nextUrl.searchParams.get("workerId") ?? undefined,
      startDate: req.nextUrl.searchParams.get("startDate") ?? undefined,
      endDate: req.nextUrl.searchParams.get("endDate") ?? undefined,
      status: req.nextUrl.searchParams.get("status") ?? undefined,
      includeDeleted: req.nextUrl.searchParams.get("includeDeleted") === "true",
      upcomingOnly: req.nextUrl.searchParams.get("upcomingOnly") === "true"
    });

    const records = await listShifts(prisma, session, filters);
    return jsonOk(records.map(formatShift));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    requireRoles(session, [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN]);

    const body = shiftCreateSchema.parse(await req.json());
    const created = await createShift(prisma, session, body);

    await logAudit(prisma, {
      tenantId: created.tenantId,
      userId: session.sub,
      action: "SHIFT_CREATE",
      entity: "Shift",
      entityId: created.id,
      details: {
        workerId: created.workerId,
        date: created.date,
        isDayOff: created.isDayOff
      }
    });

    return jsonOk(formatShift(created), 201);
  } catch (error) {
    return jsonError(error);
  }
}

