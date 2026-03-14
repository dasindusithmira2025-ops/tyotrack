import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireDevPanelToken } from "@/lib/dev-panel/auth";

export async function GET(req: Request) {
  try {
    requireDevPanelToken(req);

    const logs = await prisma.dbBackupLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20
    });

    return jsonOk(
      logs.map((log) => ({
        id: log.id,
        triggeredBy: log.triggeredBy,
        exportType: log.exportType,
        filePath: log.filePath,
        fileSizeBytes: log.fileSizeBytes,
        durationMs: log.durationMs,
        status: log.status,
        errorMessage: log.errorMessage,
        createdAt: log.createdAt.toISOString()
      }))
    );
  } catch (error) {
    return jsonError(error);
  }
}
