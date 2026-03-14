import crypto from "node:crypto";
import { ApiError } from "@/lib/http";

export type BackupTriggerSource = "manual" | "scheduled" | "developer-panel";

function getRequiredEnv(name: string): string {
  const value = (process.env[name] ?? "").trim();
  if (!value) {
    throw new ApiError(500, `${name} is not configured`);
  }
  return value;
}

export function getDevPanelPath(): string {
  const raw = (process.env.DEV_PANEL_PATH ?? "/__ops_terminal").trim();
  if (!raw.startsWith("/")) {
    return `/${raw}`;
  }
  return raw;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = req.headers.get("x-real-ip") ?? "";
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

export function verifyDevPanelPassword(input: string): boolean {
  const expected = getRequiredEnv("DEV_PANEL_PASSWORD");
  const provided = input ?? "";

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export function requireDevPanelToken(req: Request): void {
  const token = req.headers.get("x-dev-token") ?? "";
  if (!verifyDevPanelPassword(token)) {
    throw new ApiError(401, "Invalid developer token");
  }
}

export function requireBackupToken(req: Request): void {
  const token = (req.headers.get("x-backup-token") ?? "").trim();
  const expected = getRequiredEnv("DB_BACKUP_TOKEN");

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(token);
  if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw new ApiError(401, "Invalid backup token");
  }
}

export function parseTriggerSource(value: string | null | undefined, fallback: BackupTriggerSource): BackupTriggerSource {
  if (!value) {
    return fallback;
  }

  if (value === "manual" || value === "scheduled" || value === "developer-panel") {
    return value;
  }

  throw new ApiError(400, "Invalid trigger source");
}
