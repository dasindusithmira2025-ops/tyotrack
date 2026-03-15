import { z } from "zod";
import { NextRequest } from "next/server";
import { requireAuth, requireRoles, resolveTenant } from "@/lib/auth-guard";
import { ApiError, jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const updateAssignmentsSchema = z.object({
  userIds: z.array(z.string().min(1)).max(500)
});

async function resolveProject(session: Awaited<ReturnType<typeof requireAuth>>, id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      tenantId: true,
      name: true
    }
  });

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const tenantId = resolveTenant(session, project.tenantId);
  return { project, tenantId };
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(req);
    requireRoles(session, ["SUPER_ADMIN", "COMPANY_ADMIN"]);

    const { id } = await context.params;
    const { project, tenantId } = await resolveProject(session, id);

    const assignments = await prisma.projectAssignment.findMany({
      where: {
        tenantId,
        projectId: project.id
      },
      select: {
        userId: true
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return jsonOk({
      projectId: project.id,
      assignedUserIds: assignments.map((assignment) => assignment.userId)
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(req);
    requireRoles(session, ["SUPER_ADMIN", "COMPANY_ADMIN"]);

    const { id } = await context.params;
    const body = updateAssignmentsSchema.parse(await req.json());
    const { project, tenantId } = await resolveProject(session, id);

    const uniqueUserIds = [...new Set(body.userIds)];

    if (uniqueUserIds.length > 0) {
      const employees = await prisma.user.findMany({
        where: {
          tenantId,
          id: {
            in: uniqueUserIds
          },
          role: "EMPLOYEE",
          status: "ACTIVE"
        },
        select: {
          id: true
        }
      });

      if (employees.length !== uniqueUserIds.length) {
        throw new ApiError(400, "One or more selected users are not active employees in this company");
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.projectAssignment.deleteMany({
        where: {
          tenantId,
          projectId: project.id
        }
      });

      if (uniqueUserIds.length > 0) {
        await tx.projectAssignment.createMany({
          data: uniqueUserIds.map((userId) => ({
            tenantId,
            projectId: project.id,
            userId
          }))
        });
      }
    });

    await logAudit(prisma, {
      tenantId,
      userId: session.sub,
      action: "PROJECT_ASSIGNMENTS_UPDATE",
      entity: "Project",
      entityId: project.id,
      details: {
        assignedUserIds: uniqueUserIds,
        assignedCount: uniqueUserIds.length
      }
    });

    return jsonOk({
      projectId: project.id,
      assignedUserIds: uniqueUserIds
    });
  } catch (error) {
    return jsonError(error);
  }
}
