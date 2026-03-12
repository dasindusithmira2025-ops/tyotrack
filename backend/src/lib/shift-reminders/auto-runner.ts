import type { PrismaClient } from "@prisma/client";
import { runShiftReminderDispatch } from "./runner";

let started = false;
let inFlight = false;

function getIntervalMs() {
  const parsed = Number(process.env.SHIFT_REMINDER_AUTORUN_INTERVAL_MS ?? "60000");
  if (!Number.isFinite(parsed) || parsed < 10000) {
    return 60000;
  }
  return parsed;
}

export function ensureShiftReminderAutoRunner(prisma: PrismaClient): void {
  if (started) {
    return;
  }

  const enabled = (process.env.SHIFT_REMINDER_AUTORUN ?? "true").toLowerCase() !== "false";
  if (!enabled) {
    return;
  }

  started = true;
  const intervalMs = getIntervalMs();

  const tick = async () => {
    if (inFlight) {
      return;
    }

    inFlight = true;
    try {
      await runShiftReminderDispatch(prisma);
    } catch (error) {
      console.error("[shift-reminders] auto-run dispatch failed", error);
    } finally {
      inFlight = false;
    }
  };

  // Trigger once immediately and then on interval.
  void tick();
  const handle = setInterval(() => {
    void tick();
  }, intervalMs);

  if (typeof (handle as any).unref === "function") {
    (handle as any).unref();
  }

  console.info(`[shift-reminders] auto-run enabled every ${intervalMs}ms`);
}
