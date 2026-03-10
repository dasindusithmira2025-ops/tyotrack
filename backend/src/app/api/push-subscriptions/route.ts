import { NextRequest } from "next/server";
import { requireAuth, resolveTenant } from "@/lib/auth-guard";
import { jsonError, jsonOk, ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const subscriptionSchema = z.object({
  tenantId: z.string().optional(),
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  })
});

const deleteSchema = z.object({
  endpoint: z.string().url()
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = subscriptionSchema.parse(await req.json());
    const tenantId = resolveTenant(session, body.tenantId);

    if (!session.tenantId && session.role !== "SUPER_ADMIN") {
      throw new ApiError(403, "Tenant context is missing");
    }

    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: {
        tenantId,
        userId: session.sub,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        authSecret: body.keys.auth,
        userAgent: req.headers.get("user-agent"),
        lastSeenAt: new Date()
      },
      update: {
        tenantId,
        userId: session.sub,
        p256dh: body.keys.p256dh,
        authSecret: body.keys.auth,
        userAgent: req.headers.get("user-agent"),
        lastSeenAt: new Date()
      }
    });

    await logAudit(prisma, {
      tenantId,
      userId: session.sub,
      action: "PUSH_SUBSCRIPTION_UPSERT",
      entity: "PushSubscription",
      entityId: subscription.id,
      details: { endpoint: subscription.endpoint }
    });

    return jsonOk({ id: subscription.id, endpoint: subscription.endpoint }, 201);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const body = deleteSchema.parse(await req.json());

    const deleted = await prisma.pushSubscription.deleteMany({
      where: {
        endpoint: body.endpoint,
        userId: session.sub
      }
    });

    if (session.tenantId) {
      await logAudit(prisma, {
        tenantId: session.tenantId,
        userId: session.sub,
        action: "PUSH_SUBSCRIPTION_DELETE",
        entity: "PushSubscription",
        entityId: null,
        details: { endpoint: body.endpoint, deletedCount: deleted.count }
      });
    }

    return jsonOk({ deleted: deleted.count > 0 });
  } catch (error) {
    return jsonError(error);
  }
}

