import { z } from "zod";
import { jsonError, jsonOk, ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireDevPanelToken } from "@/lib/dev-panel/auth";
import { runShiftReminderDispatch } from "@/lib/shift-reminders/runner";

const schema = z.object({
  confirm: z.string()
});

export async function POST(req: Request) {
  try {
    requireDevPanelToken(req);

    const body = schema.parse(await req.json());
    if (body.confirm !== "CONFIRM") {
      throw new ApiError(400, "Type CONFIRM to execute this action");
    }

    const result = await runShiftReminderDispatch(prisma);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
