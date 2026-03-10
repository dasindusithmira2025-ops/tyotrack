import { DateTime } from "luxon";
import { ApiError } from "@/lib/http";

export const SHIFT_TIMEZONE = "Europe/Helsinki";
export const CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface ShiftTimeComputation {
  shiftStartAtUtc: Date | null;
  shiftEndAtUtc: Date | null;
  reminderDueAtUtc: Date | null;
}

function parseLocalDate(localDate: string): DateTime {
  const date = DateTime.fromISO(localDate, { zone: SHIFT_TIMEZONE });
  if (!date.isValid) {
    throw new ApiError(400, `Invalid shift date: ${localDate}`);
  }
  return date.startOf("day");
}

export function normalizeClock(value?: string | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!CLOCK_PATTERN.test(trimmed)) {
    throw new ApiError(400, `Invalid time value: ${value}`);
  }

  return trimmed;
}

export function deriveWeekMetadata(localDate: string): { weekStartDate: string; weekEndDate: string; weekRange: string } {
  const date = parseLocalDate(localDate);
  const weekStart = date.minus({ days: date.weekday - 1 });
  const weekEnd = weekStart.plus({ days: 6 });

  return {
    weekStartDate: weekStart.toISODate() as string,
    weekEndDate: weekEnd.toISODate() as string,
    weekRange: `${weekStart.toFormat("dd.LL.yyyy")} - ${weekEnd.toFormat("dd.LL.yyyy")}`
  };
}

export function deriveDayOfWeek(localDate: string): string {
  return parseLocalDate(localDate).setLocale("en").toFormat("cccc");
}

export function computeShiftTimes(localDate: string, startTime?: string | null, endTime?: string | null, isDayOff = false): ShiftTimeComputation {
  if (isDayOff) {
    return {
      shiftStartAtUtc: null,
      shiftEndAtUtc: null,
      reminderDueAtUtc: null
    };
  }

  const normalizedStart = normalizeClock(startTime);
  const normalizedEnd = normalizeClock(endTime);

  if (!normalizedStart || !normalizedEnd) {
    throw new ApiError(400, "Start time and end time are required unless the shift is a day off");
  }

  const shiftDate = parseLocalDate(localDate);
  const startLocal = DateTime.fromISO(`${shiftDate.toISODate()}T${normalizedStart}`, { zone: SHIFT_TIMEZONE });
  let endLocal = DateTime.fromISO(`${shiftDate.toISODate()}T${normalizedEnd}`, { zone: SHIFT_TIMEZONE });

  if (!startLocal.isValid || !endLocal.isValid) {
    throw new ApiError(400, "Invalid shift time window");
  }

  if (endLocal <= startLocal) {
    endLocal = endLocal.plus({ days: 1 });
  }

  return {
    shiftStartAtUtc: startLocal.toUTC().toJSDate(),
    shiftEndAtUtc: endLocal.toUTC().toJSDate(),
    reminderDueAtUtc: startLocal.minus({ hours: 1 }).toUTC().toJSDate()
  };
}

export function buildWeekWindow(reference = DateTime.now().setZone(SHIFT_TIMEZONE)): { startDate: string; endDate: string } {
  const today = reference.startOf("day");
  const currentWeekStart = today.minus({ days: today.weekday - 1 });
  const nextWeekEnd = currentWeekStart.plus({ days: 13 });

  return {
    startDate: currentWeekStart.toISODate() as string,
    endDate: nextWeekEnd.toISODate() as string
  };
}

