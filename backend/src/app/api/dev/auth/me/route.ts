import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/http";
import { requireDevAuth } from "@/lib/dev-auth";

export async function GET(req: NextRequest) {
  try {
    const session = requireDevAuth(req);
    return jsonOk({
      email: session.email,
      role: session.role,
      expiresAt: session.exp
    });
  } catch (error) {
    return jsonError(error);
  }
}
