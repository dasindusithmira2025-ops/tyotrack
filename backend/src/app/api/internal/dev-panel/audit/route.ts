import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireDevPanelToken } from "@/lib/dev-panel/auth";

export async function GET(req: Request) {
  try {
    requireDevPanelToken(req);

    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return jsonOk(
      logs.map((log) => ({
        id: log.id,
        timestamp: log.createdAt.toISOString(),
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        user: log.user
          ? {
              id: log.user.id,
              name: log.user.name,
              email: log.user.email
            }
          : null
      }))
    );
  } catch (error) {
    return jsonError(error);
  }
}
