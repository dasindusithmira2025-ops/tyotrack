import { ShiftSourceType, UserRole } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";
import * as XLSX from "xlsx";
import { deriveDayOfWeek, deriveWeekMetadata, normalizeClock, SHIFT_TIMEZONE } from "@/lib/shifts/time";

export interface ParsedShiftPreviewRow {
  workerId: string;
  workerName: string;
  workerEmail: string;
  weekRange: string;
  date: string;
  dayOfWeek: string;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  isDayOff: boolean;
  sourceRowNumber: number;
  sourceFileName: string | null;
  sourceType: ShiftSourceType;
}

export interface ParsedShiftPreviewError {
  rowNumber: number;
  code: string;
  message: string;
  raw: Record<string, string>;
}

export interface ParsedShiftPreviewResult {
  rows: ParsedShiftPreviewRow[];
  errors: ParsedShiftPreviewError[];
}

const HEADER_ALIASES: Record<string, string[]> = {
  worker: ["worker id", "worker_id", "employee id", "employee_id", "user id", "user_id", "worker", "employee", "email"],
  weekRange: ["week range", "week_range", "week"],
  date: ["date", "shift date"],
  dayOfWeek: ["day", "day of week", "day_of_week"],
  location: ["location", "site", "branch", "workplace", "shift type", "type"],
  startTime: ["start", "start time", "start_time", "from"],
  endTime: ["end", "end time", "end_time", "to"]
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeCell(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function normalizeImportedDate(value: string): string {
  const trimmed = normalizeCell(value);
  if (!trimmed) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const candidates = ["M/d/yy", "M/d/yyyy", "d/M/yy", "d/M/yyyy", "d.L.yyyy", "d.L.yy"];
  for (const format of candidates) {
    const parsed = DateTime.fromFormat(trimmed, format, { zone: SHIFT_TIMEZONE });
    if (parsed.isValid) {
      return parsed.toISODate() as string;
    }
  }

  throw new Error(`Invalid shift date: ${value}`);
}

function parseWorkbook(buffer: Buffer, fileName: string): Record<string, string>[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: false, codepage: 65001 });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "", raw: false });
}

function findColumnKey(row: Record<string, string>, aliases: string[]): string | null {
  const entries = Object.keys(row);
  for (const key of entries) {
    const normalized = normalizeHeader(key);
    if (aliases.includes(normalized)) {
      return key;
    }
  }
  return null;
}

function findWorker(value: string, workerMap: Map<string, { id: string; name: string; email: string }>) {
  const direct = workerMap.get(value.toLowerCase());
  if (direct) {
    return direct;
  }
  return workerMap.get(value);
}

function isFreeRow(raw: Record<string, string>): boolean {
  return Object.values(raw).some((value) => normalizeCell(value).toLowerCase() === "free");
}

export async function parseShiftImportPreview(
  prisma: PrismaClient,
  tenantId: string,
  fileName: string,
  buffer: Buffer
): Promise<ParsedShiftPreviewResult> {
  const workers = await prisma.user.findMany({
    where: {
      tenantId,
      role: UserRole.EMPLOYEE,
      status: "ACTIVE"
    },
    select: {
      id: true,
      name: true,
      email: true
    }
  });

  const workerMap = new Map<string, { id: string; name: string; email: string }>();
  for (const worker of workers) {
    workerMap.set(worker.id, worker);
    workerMap.set(worker.email.toLowerCase(), worker);
  }

  const sourceRows = parseWorkbook(buffer, fileName);
  const rows: ParsedShiftPreviewRow[] = [];
  const errors: ParsedShiftPreviewError[] = [];

  let lastDate = "";
  let lastDay = "";
  let lastWeekRange = "";

  sourceRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const sanitizedRow = Object.fromEntries(
      Object.entries(rawRow).map(([key, value]) => [key, normalizeCell(value)])
    );

    const hasValues = Object.values(sanitizedRow).some(Boolean);
    if (!hasValues) {
      return;
    }

    const workerKey = findColumnKey(sanitizedRow, HEADER_ALIASES.worker);
    const weekRangeKey = findColumnKey(sanitizedRow, HEADER_ALIASES.weekRange);
    const dateKey = findColumnKey(sanitizedRow, HEADER_ALIASES.date);
    const dayKey = findColumnKey(sanitizedRow, HEADER_ALIASES.dayOfWeek);
    const locationKey = findColumnKey(sanitizedRow, HEADER_ALIASES.location);
    const startKey = findColumnKey(sanitizedRow, HEADER_ALIASES.startTime);
    const endKey = findColumnKey(sanitizedRow, HEADER_ALIASES.endTime);

    const workerValue = workerKey ? sanitizedRow[workerKey] : "";
    const freeRow = isFreeRow(sanitizedRow);

    let normalizedDateValue = "";
    try {
      normalizedDateValue = dateKey ? normalizeImportedDate(sanitizedRow[dateKey]) : "";
    } catch (error) {
      errors.push({
        rowNumber,
        code: "INVALID_DATE",
        message: error instanceof Error ? error.message : "Invalid date value",
        raw: sanitizedRow
      });
      return;
    }

    const resolvedDate = normalizedDateValue || lastDate;
    const explicitDay = dayKey ? sanitizedRow[dayKey] : "";
    const resolvedDay = explicitDay || lastDay || (resolvedDate ? deriveDayOfWeek(resolvedDate) : "");
    const providedWeekRange = weekRangeKey ? sanitizedRow[weekRangeKey] : "";
    const resolvedWeekRange = providedWeekRange || lastWeekRange || (resolvedDate ? deriveWeekMetadata(resolvedDate).weekRange : "");

    if (normalizedDateValue) {
      lastDate = normalizedDateValue;
    }
    if (explicitDay) {
      lastDay = explicitDay;
    } else if (resolvedDate) {
      lastDay = resolvedDay;
    }
    if (providedWeekRange) {
      lastWeekRange = providedWeekRange;
    } else if (resolvedWeekRange) {
      lastWeekRange = resolvedWeekRange;
    }

    if (!workerValue) {
      errors.push({ rowNumber, code: "MISSING_WORKER", message: "Worker identifier is required", raw: sanitizedRow });
      return;
    }

    const worker = findWorker(workerValue, workerMap);
    if (!worker) {
      errors.push({ rowNumber, code: "UNKNOWN_WORKER", message: `No active employee found for '${workerValue}'`, raw: sanitizedRow });
      return;
    }

    if (!resolvedDate) {
      errors.push({ rowNumber, code: "MISSING_DATE", message: "Date is missing and could not be inherited from the previous row", raw: sanitizedRow });
      return;
    }

    const location = locationKey ? sanitizedRow[locationKey] || null : null;
    const startTime = startKey ? sanitizedRow[startKey] : "";
    const endTime = endKey ? sanitizedRow[endKey] : "";

    try {
      rows.push({
        workerId: worker.id,
        workerName: worker.name,
        workerEmail: worker.email,
        weekRange: resolvedWeekRange,
        date: resolvedDate,
        dayOfWeek: resolvedDay || deriveDayOfWeek(resolvedDate),
        location: freeRow ? (location || "Free") : location,
        startTime: freeRow ? null : normalizeClock(startTime),
        endTime: freeRow ? null : normalizeClock(endTime),
        isDayOff: freeRow,
        sourceRowNumber: rowNumber,
        sourceFileName: fileName,
        sourceType: ShiftSourceType.IMPORT
      });
    } catch (error) {
      errors.push({
        rowNumber,
        code: "INVALID_ROW",
        message: error instanceof Error ? error.message : "Unable to parse row",
        raw: sanitizedRow
      });
    }
  });

  return { rows, errors };
}
