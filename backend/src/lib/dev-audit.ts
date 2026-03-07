import { appendFile } from "node:fs/promises";
import path from "node:path";

interface DevAuditInput {
  actorEmail: string;
  action: string;
  endpoint: string;
  resource?: string;
  targetId?: string;
  sql?: string;
  payload?: unknown;
  success: boolean;
  error?: string;
}

const DEV_AUDIT_FILE = path.join(process.cwd(), "dev-audit.log");

export async function logDevAudit(input: DevAuditInput): Promise<void> {
  try {
    const event = {
      timestamp: new Date().toISOString(),
      ...input
    };

    const line = `${JSON.stringify(event)}\n`;
    await appendFile(DEV_AUDIT_FILE, line, { encoding: "utf8" });
  } catch (error) {
    console.error("Failed to write dev audit log", error);
  }
}
