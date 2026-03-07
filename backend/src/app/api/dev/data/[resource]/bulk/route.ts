import { z } from "zod";
import { NextRequest } from "next/server";
import { ApiError, jsonError, jsonOk } from "@/lib/http";
import { requireDevAuth } from "@/lib/dev-auth";
import {
  buildWhereClause,
  coercePrimaryIdValue,
  getDevDelegate,
  getPrimaryKeyField,
  sanitizeDataForModel
} from "@/lib/dev-resources";
import { logDevAudit } from "@/lib/dev-audit";

const schema = z.object({
  action: z.enum(["update", "delete"]),
  ids: z.array(z.string()).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  data: z.record(z.string(), z.unknown()).optional()
});

export async function POST(req: NextRequest, context: { params: Promise<{ resource: string }> }) {
  try {
    const session = requireDevAuth(req);
    const { resource } = await context.params;
    const { delegate, model } = getDevDelegate(resource);
    const primaryKey = getPrimaryKeyField(resource);
    const body = schema.parse(await req.json());

    const whereFromFilters = buildWhereClause(resource, body.filters ?? {});
    let where: Record<string, unknown> = whereFromFilters;

    if (body.ids && body.ids.length > 0) {
      where = {
        ...whereFromFilters,
        [primaryKey.name]: {
          in: body.ids.map((id) => coercePrimaryIdValue(resource, id))
        }
      };
    }

    if (body.action === "update") {
      if (!body.data) {
        throw new ApiError(400, "data is required for bulk update");
      }

      const data = sanitizeDataForModel(resource, body.data);
      if (Object.keys(data).length === 0) {
        throw new ApiError(400, "No writable fields provided for bulk update");
      }

      const result = await (delegate.updateMany as (args: unknown) => Promise<{ count: number }>)({
        where,
        data
      });

      await logDevAudit({
        actorEmail: session.email,
        action: "DEV_DATA_BULK_UPDATE",
        endpoint: `/api/dev/data/${resource}/bulk`,
        resource: model.name,
        payload: { ids: body.ids ?? [], filters: body.filters ?? {}, data },
        success: true
      });

      return jsonOk({ affected: result.count });
    }

    const result = await (delegate.deleteMany as (args: unknown) => Promise<{ count: number }>)({
      where
    });

    await logDevAudit({
      actorEmail: session.email,
      action: "DEV_DATA_BULK_DELETE",
      endpoint: `/api/dev/data/${resource}/bulk`,
      resource: model.name,
      payload: { ids: body.ids ?? [], filters: body.filters ?? {} },
      success: true
    });

    return jsonOk({ affected: result.count });
  } catch (error) {
    return jsonError(error);
  }
}
