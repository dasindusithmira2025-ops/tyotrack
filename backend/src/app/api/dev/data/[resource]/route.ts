import { z } from "zod";
import { NextRequest } from "next/server";
import { ApiError, jsonError, jsonOk } from "@/lib/http";
import { requireDevAuth } from "@/lib/dev-auth";
import {
  buildOrderBy,
  buildWhereClause,
  getDevDelegate,
  parseFilterParam,
  sanitizeDataForModel
} from "@/lib/dev-resources";
import { logDevAudit } from "@/lib/dev-audit";

const createSchema = z.object({
  data: z.record(z.string(), z.unknown())
});

function parsePagination(req: NextRequest) {
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("pageSize") ?? "25")));
  return { page, pageSize };
}

export async function GET(req: NextRequest, context: { params: Promise<{ resource: string }> }) {
  try {
    const session = requireDevAuth(req);
    const { resource } = await context.params;
    const { delegate, model } = getDevDelegate(resource);

    const { page, pageSize } = parsePagination(req);
    const sort = req.nextUrl.searchParams.get("sort");
    const order = req.nextUrl.searchParams.get("order");
    const filters = parseFilterParam(req.nextUrl.searchParams.get("filters"));

    const where = buildWhereClause(resource, filters);
    const orderBy = buildOrderBy(resource, sort, order);
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      (delegate.findMany as (args: unknown) => Promise<unknown[]> )({
        where,
        ...(orderBy ? { orderBy } : {}),
        skip,
        take: pageSize
      }),
      (delegate.count as (args: unknown) => Promise<number>)({ where })
    ]);

    await logDevAudit({
      actorEmail: session.email,
      action: "DEV_DATA_LIST",
      endpoint: `/api/dev/data/${resource}`,
      resource: model.name,
      payload: { page, pageSize, sort, order, filters },
      success: true
    });

    return jsonOk({
      items,
      total,
      page,
      pageSize
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ resource: string }> }) {
  try {
    const session = requireDevAuth(req);
    const { resource } = await context.params;
    const { delegate, model } = getDevDelegate(resource);
    const body = createSchema.parse(await req.json());
    const data = sanitizeDataForModel(resource, body.data);

    if (Object.keys(data).length === 0) {
      throw new ApiError(400, "No writable fields provided for create");
    }

    const created = await (delegate.create as (args: unknown) => Promise<unknown>)({
      data
    });

    await logDevAudit({
      actorEmail: session.email,
      action: "DEV_DATA_CREATE",
      endpoint: `/api/dev/data/${resource}`,
      resource: model.name,
      payload: data,
      success: true
    });

    return jsonOk(created, 201);
  } catch (error) {
    return jsonError(error);
  }
}
