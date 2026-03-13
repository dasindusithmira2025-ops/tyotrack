import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const markReadSchema = z.object({
  ids: z.array(z.string().min(1)).max(200).optional(),
  markAll: z.boolean().optional().default(false)
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(100, Math.trunc(limitParam))) : 20;
    const unreadOnly = (req.nextUrl.searchParams.get("unreadOnly") ?? "true").toLowerCase() !== "false";

    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.sub,
        ...(session.tenantId ? { tenantId: session.tenantId } : {}),
        ...(unreadOnly ? { isRead: false } : {})
      },
      orderBy: {
        createdAt: "desc"
      },
      take: limit
    });

    return jsonOk(
      notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        payload: notification.payload,
        isRead: notification.isRead,
        readAt: notification.readAt?.toISOString() ?? null,
        createdAt: notification.createdAt.toISOString()
      }))
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = markReadSchema.parse(await req.json());

    const where = {
      userId: session.sub,
      ...(session.tenantId ? { tenantId: session.tenantId } : {}),
      ...(body.markAll
        ? { isRead: false }
        : {
            id: {
              in: body.ids ?? []
            }
          })
    };

    const result = await prisma.notification.updateMany({
      where,
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    if (session.tenantId) {
      await logAudit(prisma, {
        tenantId: session.tenantId,
        userId: session.sub,
        action: "NOTIFICATION_MARK_READ",
        entity: "Notification",
        entityId: null,
        details: {
          markAll: body.markAll,
          count: result.count,
          ids: body.markAll ? null : body.ids ?? []
        }
      });
    }

    return jsonOk({ updated: result.count });
  } catch (error) {
    return jsonError(error);
  }
}

