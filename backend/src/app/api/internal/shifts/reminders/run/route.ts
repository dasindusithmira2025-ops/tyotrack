import { NextRequest } from "next/server";
import { jsonError, jsonOk, ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { runShiftReminderDispatch } from "@/lib/shift-reminders/runner";

function validateToken(req: NextRequest) {
  const expected = process.env.SHIFT_REMINDER_RUNNER_TOKEN;
  if (!expected) {
    throw new ApiError(500, "SHIFT_REMINDER_RUNNER_TOKEN is not configured");
  }

  const headerToken = req.headers.get("x-shift-run-token");
  const bearerToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const provided = headerToken || bearerToken;

  if (!provided || provided !== expected) {
    throw new ApiError(401, "Invalid reminder runner token");
  }
}

export async function POST(req: NextRequest) {
  try {
    validateToken(req);
    const result = await runShiftReminderDispatch(prisma);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}

