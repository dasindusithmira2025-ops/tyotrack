import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireAuth, requireRoles } from "@/lib/auth-guard";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { shiftReminderSettingsUpdateSchema } from "@/lib/shifts/schemas";
import { getShiftReminderSettings, updateShiftReminderSettings } from "@/lib/shifts/service";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    requireRoles(session, [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN]);

    const settings = await getShiftReminderSettings(
      prisma,
      session,
      req.nextUrl.searchParams.get("tenantId") ?? undefined
    );

    return jsonOk({
      tenantId: settings.tenantId,
      emailRemindersEnabled: settings.emailRemindersEnabled,
      updatedAt: settings.updatedAt.toISOString()
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    requireRoles(session, [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN]);

    const body = shiftReminderSettingsUpdateSchema.parse(await req.json());
    const settings = await updateShiftReminderSettings(prisma, session, body);

    await logAudit(prisma, {
      tenantId: settings.tenantId,
      userId: session.sub,
      action: "SHIFT_REMINDER_SETTINGS_UPDATE",
      entity: "ShiftReminderSetting",
      entityId: settings.id,
      details: {
        emailRemindersEnabled: settings.emailRemindersEnabled
      }
    });

    return jsonOk({
      tenantId: settings.tenantId,
      emailRemindersEnabled: settings.emailRemindersEnabled,
      updatedAt: settings.updatedAt.toISOString()
    });
  } catch (error) {
    return jsonError(error);
  }
}
