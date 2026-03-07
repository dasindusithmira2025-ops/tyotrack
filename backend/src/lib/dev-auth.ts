import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { ApiError } from "@/lib/http";

export const DEV_PANEL_EMAIL = "dasindusithmira2025@gmail.com";
export const DEV_PANEL_PASSWORD = "Dasindu@13#";
export const DEV_PANEL_ROLE = "GOD";

const DEV_SESSION_COOKIE = "tyo_dev_session";
const DEV_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

interface DevSessionPayload {
  email: string;
  role: typeof DEV_PANEL_ROLE;
  iat: number;
  exp: number;
}

function getSigningSecret(): string {
  return process.env.NEXTAUTH_SECRET ?? "tyotrack-dev-panel-fallback-secret";
}

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signSegment(segment: string): string {
  return crypto.createHmac("sha256", getSigningSecret()).update(segment).digest("base64url");
}

export function createDevSessionToken(email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: DevSessionPayload = {
    email,
    role: DEV_PANEL_ROLE,
    iat: now,
    exp: now + DEV_SESSION_MAX_AGE_SECONDS
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signSegment(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyDevSessionToken(token: string): DevSessionPayload | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signSegment(encodedPayload);
  if (signature.length !== expectedSignature.length) {
    return null;
  }
  const signatureMatches = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
  if (!signatureMatches) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as DevSessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload?.email || payload.role !== DEV_PANEL_ROLE || payload.exp <= now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function requireDevAuth(req: NextRequest): DevSessionPayload {
  const rawToken = req.cookies.get(DEV_SESSION_COOKIE)?.value;
  if (!rawToken) {
    throw new ApiError(401, "Developer session required");
  }

  const payload = verifyDevSessionToken(rawToken);
  if (!payload) {
    throw new ApiError(401, "Invalid or expired developer session");
  }

  return payload;
}

export function setDevSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(DEV_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEV_SESSION_MAX_AGE_SECONDS
  });
}

export function clearDevSessionCookie(response: NextResponse): void {
  response.cookies.set(DEV_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}
