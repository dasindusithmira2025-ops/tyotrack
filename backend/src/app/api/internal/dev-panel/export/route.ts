import { jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireDevPanelToken } from "@/lib/dev-panel/auth";
import { createBackupArtifact, parseExportType } from "@/lib/dev-panel/db-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    requireDevPanelToken(req);

    const url = new URL(req.url);
    const exportType = parseExportType(url.searchParams.get("type"), "sql-full");

    const artifact = await createBackupArtifact({
      prisma,
      exportType,
      triggeredBy: "developer-panel",
      saveToBackupsDir: false
    });

    return new Response(artifact.buffer, {
      status: 200,
      headers: {
        "Content-Type": artifact.contentType,
        "Content-Disposition": `attachment; filename=\"${artifact.fileName}\"`,
        "Content-Length": String(artifact.sizeBytes),
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return jsonError(error);
  }
}
