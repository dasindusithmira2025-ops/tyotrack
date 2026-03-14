import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireDevPanelToken } from "@/lib/dev-panel/auth";

export async function GET(req: Request) {
  try {
    requireDevPanelToken(req);

    const [users, companies, timeEntries, shifts] = await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.timeEntry.count(),
      prisma.shift.count()
    ]);

    return jsonOk({
      users,
      companies,
      timeEntries,
      shifts,
      environment: process.env.NODE_ENV ?? "unknown",
      nodeVersion: process.version,
      platform: process.platform
    });
  } catch (error) {
    return jsonError(error);
  }
}
