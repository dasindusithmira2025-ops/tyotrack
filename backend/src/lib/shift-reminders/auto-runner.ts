import type { PrismaClient } from "@prisma/client";
import { runShiftReminderDispatch } from "./runner";

let started = false;
let inFlight = false;
let lastOpportunisticDispatchAt = 0;

const MIN_OPPORTUNISTIC_INTERVAL_MS = 15000;

function getIntervalMs() {
  const parsed = Number(process.env.SHIFT_REMINDER_AUTORUN_INTERVAL_MS ?? "60000");
  if (!Number.isFinite(parsed) || parsed < 10000) {
    return 60000;
  }
  return parsed;
}

function isAutoRunnerEnabled() {
  return (process.env.SHIFT_REMINDER_AUTORUN ?? "true").toLowerCase() !== "false";
}

async function dispatchOnce(prisma: PrismaClient, source: 'auto-runner' | 'opportunistic') {
  if (inFlight) {
    return;
  }

  inFlight = true;
  try {
    await runShiftReminderDispatch(prisma);
  } catch (error) {
    console.error(`[shift-reminders] ${source} dispatch failed`, error);
  } finally {
    inFlight = false;
  }
}

export function ensureShiftReminderAutoRunner(prisma: PrismaClient): void {
  if (started) {
    return;
  }

  if (!isAutoRunnerEnabled()) {
    return;
  }

  started = true;
  const intervalMs = getIntervalMs();

  void dispatchOnce(prisma, 'auto-runner');
  const handle = setInterval(() => {
    void dispatchOnce(prisma, 'auto-runner');
  }, intervalMs);

  if (typeof (handle as any).unref === "function") {
    (handle as any).unref();
  }

  console.info(`[shift-reminders] auto-run enabled every ${intervalMs}ms`);
}

export function triggerOpportunisticShiftReminderDispatch(prisma: PrismaClient): void {
  if (!isAutoRunnerEnabled()) {
    return;
  }

  const now = Date.now();
  if (now - lastOpportunisticDispatchAt < MIN_OPPORTUNISTIC_INTERVAL_MS) {
    return;
  }

  lastOpportunisticDispatchAt = now;
  void dispatchOnce(prisma, 'opportunistic');
}
