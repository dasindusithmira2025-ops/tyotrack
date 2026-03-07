import { z } from "zod";
import { NextRequest } from "next/server";
import { ApiError, jsonError, jsonOk } from "@/lib/http";
import { requireDevAuth } from "@/lib/dev-auth";
import { coercePrimaryIdValue, getDevDelegate, getPrimaryKeyField, sanitizeDataForModel } from "@/lib/dev-resources";
import { logDevAudit } from "@/lib/dev-audit";

const patchSchema = z.object({
  data: z.record(z.string(), z.unknown())
});

export async function PATCH(req: NextRequest, context: { params: Promise<{ resource: string; id: string }> }) {
  try {
    const session = requireDevAuth(req);
    const { resource, id } = await context.params;
    const { delegate, model } = getDevDelegate(resource);
    const primaryKey = getPrimaryKeyField(resource);
    const body = patchSchema.parse(await req.json());
    const data = sanitizeDataForModel(resource, body.data);

    if (Object.keys(data).length === 0) {
      throw new ApiError(400, "No writable fields provided for update");
    }

    const where = { [primaryKey.name]: coercePrimaryIdValue(resource, id) };
    const updated = await (delegate.update as (args: unknown) => Promise<unknown>)({
      where,
      data
    });

    await logDevAudit({
      actorEmail: session.email,
      action: "DEV_DATA_UPDATE",
      endpoint: `/api/dev/data/${resource}/${id}`,
      resource: model.name,
      targetId: id,
      payload: data,
      success: true
    });

    return jsonOk(updated);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ resource: string; id: string }> }) {
  try {
    const session = requireDevAuth(req);
    const { resource, id } = await context.params;
    const { delegate, model } = getDevDelegate(resource);
    const primaryKey = getPrimaryKeyField(resource);

    const where = { [primaryKey.name]: coercePrimaryIdValue(resource, id) };
    await (delegate.delete as (args: unknown) => Promise<unknown>)({
      where
    });

    await logDevAudit({
      actorEmail: session.email,
      action: "DEV_DATA_DELETE",
      endpoint: `/api/dev/data/${resource}/${id}`,
      resource: model.name,
      targetId: id,
      success: true
    });

    return jsonOk({ deleted: true, id });
  } catch (error) {
    return jsonError(error);
  }
}
