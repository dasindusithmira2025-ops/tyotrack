import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";
import { ensureShiftReminderAutoRunner } from "@/lib/shift-reminders/auto-runner";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    ensureShiftReminderAutoRunner(prisma);

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenantId: true,
        status: true
      }
    });

    if (!user) {
      return jsonOk(null);
    }

    return jsonOk({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.tenantId,
      status: user.status
    });
  } catch (error) {
    return jsonError(error);
  }
}
