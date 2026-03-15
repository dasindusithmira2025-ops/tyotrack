import { z } from "zod";
import { NextRequest } from "next/server";
import { requireAuth, resolveTenant } from "@/lib/auth-guard";
import { ApiError, jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const createProjectSchema = z.object({
  tenantId: z.string().min(1).optional(),
  name: z.string().min(2),
  color: z.string().min(4),
  workspaceId: z.string().optional()
});

function serializeProjects(
  projects: Array<{
    id: string;
    tenantId: string;
    name: string;
    color: string;
    status: "ACTIVE" | "ARCHIVED";
    workspaceId: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { assignments: number };
  }>
) {
  return projects.map(({ _count, ...project }) => ({
    ...project,
    assignedEmployeeCount: _count.assignments
  }));
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const tenantIdQuery = req.nextUrl.searchParams.get("tenantId");
    const workspaceId = req.nextUrl.searchParams.get("workspaceId");
    const status = req.nextUrl.searchParams.get("status") as "ACTIVE" | "ARCHIVED" | null;

    const assignmentFilter =
      session.role === "EMPLOYEE"
        ? {
            assignments: {
              some: {
                userId: session.sub
              }
            }
          }
        : {};

    if (workspaceId) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { tenantId: true }
      });

      if (!workspace) {
        throw new ApiError(404, "Workspace not found");
      }

      const tenantId = resolveTenant(session, workspace.tenantId);
      const projects = await prisma.project.findMany({
        where: {
          tenantId,
          workspaceId,
          ...(status ? { status } : {}),
          ...assignmentFilter
        },
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { assignments: true }
          }
        }
      });

      return jsonOk(serializeProjects(projects));
    }

    const tenantId = resolveTenant(session, tenantIdQuery);
    const projects = await prisma.project.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
        ...assignmentFilter
      },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { assignments: true }
        }
      }
    });

    return jsonOk(serializeProjects(projects));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (session.role !== "SUPER_ADMIN" && session.role !== "COMPANY_ADMIN") {
      throw new ApiError(403, "Forbidden");
    }

    const body = createProjectSchema.parse(await req.json());
    let tenantId: string;
    let workspaceId = body.workspaceId;

    if (workspaceId && workspaceId.trim().length > 0) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, tenantId: true, status: true }
      });

      if (!workspace || workspace.status !== "ACTIVE") {
        throw new ApiError(404, "Workspace not found or inactive");
      }

      tenantId = resolveTenant(session, workspace.tenantId);
    } else {
      tenantId = resolveTenant(session, body.tenantId);
      const defaultWorkspace = await prisma.workspace.findFirst({
        where: { tenantId, status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: { id: true }
      });

      workspaceId = defaultWorkspace?.id;
    }

    const project = await prisma.project.create({
      data: {
        tenantId,
        name: body.name,
        color: body.color,
        workspaceId: workspaceId ?? null,
        status: "ACTIVE"
      }
    });

    await logAudit(prisma, {
      tenantId,
      userId: session.sub,
      action: "PROJECT_CREATE",
      entity: "Project",
      entityId: project.id,
      details: { name: project.name }
    });

    return jsonOk(project, 201);
  } catch (error) {
    return jsonError(error);
  }
}
