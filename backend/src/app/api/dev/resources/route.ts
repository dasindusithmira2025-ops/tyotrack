import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/http";
import { requireDevAuth } from "@/lib/dev-auth";
import { listDevResources } from "@/lib/dev-resources";
import { logDevAudit } from "@/lib/dev-audit";

export async function GET(req: NextRequest) {
  try {
    const session = requireDevAuth(req);
    const resources = listDevResources();

    await logDevAudit({
      actorEmail: session.email,
      action: "DEV_RESOURCES_READ",
      endpoint: "/api/dev/resources",
      success: true
    });

    return jsonOk(resources);
  } catch (error) {
    return jsonError(error);
  }
}
