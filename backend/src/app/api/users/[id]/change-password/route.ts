import { z } from "zod";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { ApiError, jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8)
});

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth(req);
    const body = schema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const isOwner = session.sub === id;
    const isAdmin = session.role === "SUPER_ADMIN" || session.role === "COMPANY_ADMIN";

    if (!isOwner && !isAdmin) {
      throw new ApiError(403, "Forbidden");
    }

    if (session.role === "COMPANY_ADMIN" && user.tenantId !== session.tenantId) {
      throw new ApiError(403, "Cross-tenant access is not allowed");
    }

    if (session.role === "COMPANY_ADMIN" && !isOwner && user.role !== "EMPLOYEE") {
      throw new ApiError(403, "Company admins can only change employee passwords");
    }

    if (isOwner) {
      if (!body.currentPassword) {
        throw new ApiError(400, "Current password is required");
      }

      const valid = await verifyPassword(body.currentPassword, user.passwordHash);
      if (!valid) {
        throw new ApiError(401, "Current password is incorrect");
      }
    }

    await prisma.user.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(body.newPassword)
      }
    });

    if (user.tenantId) {
      await logAudit(prisma, {
        tenantId: user.tenantId,
        userId: session.sub,
        action: "USER_PASSWORD_CHANGE",
        entity: "User",
        entityId: user.id
      });
    }

    return jsonOk({ success: true });
  } catch (error) {
    return jsonError(error);
  }
}
