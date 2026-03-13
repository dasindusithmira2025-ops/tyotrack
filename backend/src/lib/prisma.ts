import { PrismaClient } from "@prisma/client";
import { ensureShiftReminderAutoRunner } from "@/lib/shift-reminders/auto-runner";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function shouldStartAutoRunner(): boolean {
  if (process.env.NODE_ENV === "test") {
    return false;
  }

  const lifecycle = (process.env.npm_lifecycle_event ?? "").toLowerCase();
  if (lifecycle === "build") {
    return false;
  }

  const nextPhase = (process.env.NEXT_PHASE ?? "").toLowerCase();
  if (nextPhase.includes("build")) {
    return false;
  }

  const argv = process.argv.join(" ").toLowerCase();
  if (argv.includes("next") && argv.includes("build")) {
    return false;
  }

  return true;
}

export const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

if (shouldStartAutoRunner()) {
  ensureShiftReminderAutoRunner(prisma);
}
