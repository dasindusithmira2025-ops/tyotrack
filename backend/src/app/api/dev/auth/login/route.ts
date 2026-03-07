import { z } from "zod";
import { ApiError, jsonError, jsonOk } from "@/lib/http";
import {
  createDevSessionToken,
  DEV_PANEL_EMAIL,
  DEV_PANEL_PASSWORD,
  DEV_PANEL_ROLE,
  setDevSessionCookie
} from "@/lib/dev-auth";
import { logDevAudit } from "@/lib/dev-audit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const email = body.email.trim().toLowerCase();
    const password = body.password;

    const isValid = email === DEV_PANEL_EMAIL && password === DEV_PANEL_PASSWORD;
    if (!isValid) {
      await logDevAudit({
        actorEmail: email,
        action: "DEV_LOGIN_FAILED",
        endpoint: "/api/dev/auth/login",
        success: false,
        error: "Invalid developer credentials"
      });
      throw new ApiError(401, "Invalid developer credentials");
    }

    const token = createDevSessionToken(email);
    const response = jsonOk({ email, role: DEV_PANEL_ROLE });
    setDevSessionCookie(response, token);

    await logDevAudit({
      actorEmail: email,
      action: "DEV_LOGIN_SUCCESS",
      endpoint: "/api/dev/auth/login",
      success: true
    });

    return response;
  } catch (error) {
    return jsonError(error);
  }
}
