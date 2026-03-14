import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireBackupToken, parseTriggerSource } from "@/lib/dev-panel/auth";
import { createBackupArtifact, parseExportType } from "@/lib/dev-panel/db-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const modeSchema = z.enum(["download", "save", "json"]);

export async function GET(req: Request) {
  try {
    requireBackupToken(req);

    const url = new URL(req.url);
    const mode = modeSchema.parse((url.searchParams.get("mode") ?? "download").toLowerCase());
    const triggeredBy = parseTriggerSource(url.searchParams.get("triggeredBy"), "manual");

    if (mode === "json") {
      const artifact = await createBackupArtifact({
        prisma,
        exportType: "json",
        triggeredBy,
        saveToBackupsDir: false
      });

      return new Response(artifact.buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        }
      });
    }

    const exportType = parseExportType(url.searchParams.get("exportType"), "sql-full");

    const artifact = await createBackupArtifact({
      prisma,
      exportType,
      triggeredBy,
      saveToBackupsDir: mode === "save"
    });

    if (mode === "save") {
      return jsonOk({
        path: artifact.filePath,
        sizeBytes: artifact.sizeBytes,
        fileName: artifact.fileName,
        exportType: artifact.exportType,
        durationMs: artifact.durationMs
      });
    }

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
