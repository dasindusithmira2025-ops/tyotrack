import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/http";
import { clearDevSessionCookie, requireDevAuth } from "@/lib/dev-auth";
import { logDevAudit } from "@/lib/dev-audit";

export async function POST(req: NextRequest) {
  try {
    const session = (() => {
      try {
        return requireDevAuth(req);
      } catch {
        return null;
      }
    })();
    const response = jsonOk({ success: true });
    clearDevSessionCookie(response);

    if (session) {
      await logDevAudit({
        actorEmail: session.email,
        action: "DEV_LOGOUT",
        endpoint: "/api/dev/auth/logout",
        success: true
      });
    }

    return response;
  } catch (error) {
    return jsonError(error);
  }
}
