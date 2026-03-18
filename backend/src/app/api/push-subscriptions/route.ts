import { z } from "zod";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { ApiError, jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const subscriptionSchema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  })
});

const deleteSchema = z.object({
  endpoint: z.string().min(1).optional()
});

function requireTenant(tenantId: string | null): string {
  if (!tenantId) {
    throw new ApiError(403, "Tenant context is required for push subscriptions");
  }

  return tenantId;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const tenantId = requireTenant(session.tenantId);

    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        tenantId,
        userId: session.sub
      },
      select: {
        id: true,
        endpoint: true,
        createdAt: true,
        updatedAt: true,
        lastSeenAt: true
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return jsonOk(subscriptions);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const tenantId = requireTenant(session.tenantId);
    const body = subscriptionSchema.parse(await req.json());

    const userAgent = req.headers.get("user-agent") ?? null;
    const now = new Date();

    const subscription = await prisma.pushSubscription.upsert({
      where: {
        endpoint: body.endpoint
      },
      create: {
        tenantId,
        userId: session.sub,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        authSecret: body.keys.auth,
        userAgent,
        lastSeenAt: now
      },
      update: {
        tenantId,
        userId: session.sub,
        p256dh: body.keys.p256dh,
        authSecret: body.keys.auth,
        userAgent,
        lastSeenAt: now
      },
      select: {
        id: true,
        endpoint: true,
        updatedAt: true
      }
    });

    return jsonOk(subscription, 201);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const tenantId = requireTenant(session.tenantId);

    const payload = await req.json().catch(() => ({}));
    const body = deleteSchema.parse(payload);

    const result = await prisma.pushSubscription.deleteMany({
      where: {
        tenantId,
        userId: session.sub,
        ...(body.endpoint ? { endpoint: body.endpoint } : {})
      }
    });

    return jsonOk({ removed: result.count });
  } catch (error) {
    return jsonError(error);
  }
}
