import { z } from "zod";
import { NextRequest } from "next/server";
import { ApiError, jsonError, jsonOk } from "@/lib/http";
import { requireDevAuth } from "@/lib/dev-auth";
import { prisma } from "@/lib/prisma";
import { logDevAudit } from "@/lib/dev-audit";

const schema = z.object({
  sql: z.string().min(1),
  mode: z.enum(["auto", "query", "execute"]).default("auto")
});

function inferSqlMode(sql: string): "query" | "execute" {
  const firstToken = sql.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (["select", "with", "show", "describe", "explain"].includes(firstToken)) {
    return "query";
  }
  return "execute";
}

export async function POST(req: NextRequest) {
  try {
    const session = requireDevAuth(req);
    const body = schema.parse(await req.json());
    const sql = body.sql.trim();
    const resolvedMode = body.mode === "auto" ? inferSqlMode(sql) : body.mode;

    if (!sql) {
      throw new ApiError(400, "SQL query is required");
    }

    if (resolvedMode === "query") {
      const rows = await prisma.$queryRawUnsafe(sql);

      await logDevAudit({
        actorEmail: session.email,
        action: "DEV_SQL_QUERY",
        endpoint: "/api/dev/sql/execute",
        sql,
        success: true
      });

      return jsonOk({
        mode: "query",
        rows
      });
    }

    const affected = await prisma.$executeRawUnsafe(sql);

    await logDevAudit({
      actorEmail: session.email,
      action: "DEV_SQL_EXECUTE",
      endpoint: "/api/dev/sql/execute",
      sql,
      success: true
    });

    return jsonOk({
      mode: "execute",
      affected
    });
  } catch (error) {
    const sql = await req
      .clone()
      .json()
      .then((body) => (typeof body?.sql === "string" ? body.sql : ""))
      .catch(() => "");

    try {
      await logDevAudit({
        actorEmail: "unknown",
        action: "DEV_SQL_FAILED",
        endpoint: "/api/dev/sql/execute",
        sql,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    } catch {
      // Ignore audit write failures for error path.
    }

    return jsonError(error);
  }
}
