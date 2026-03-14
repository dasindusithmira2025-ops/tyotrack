import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireDevPanelToken } from "@/lib/dev-panel/auth";
import { getSystemStats } from "@/lib/dev-panel/db-backup";

export async function GET(req: Request) {
  try {
    requireDevPanelToken(req);
    const stats = await getSystemStats(prisma);
    return jsonOk(stats);
  } catch (error) {
    return jsonError(error);
  }
}
