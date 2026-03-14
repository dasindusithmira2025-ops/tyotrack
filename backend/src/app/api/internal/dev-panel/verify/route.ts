import { z } from "zod";
import { jsonError, jsonOk, ApiError } from "@/lib/http";
import { getClientIp, verifyDevPanelPassword, getDevPanelPath } from "@/lib/dev-panel/auth";
import { checkVerifyRateLimit } from "@/lib/dev-panel/rate-limit";

const schema = z.object({
  password: z.string().min(1)
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const limit = checkVerifyRateLimit(`verify:${ip}`);
    if (!limit.allowed) {
      throw new ApiError(429, "Too many attempts. Try again later.", {
        retryAfterMs: limit.retryAfterMs
      });
    }

    const body = schema.parse(await req.json());
    const valid = verifyDevPanelPassword(body.password);
    if (!valid) {
      throw new ApiError(401, "Invalid developer password", {
        remainingAttempts: limit.remaining
      });
    }

    return jsonOk({
      valid: true,
      path: getDevPanelPath()
    });
  } catch (error) {
    return jsonError(error);
  }
}
