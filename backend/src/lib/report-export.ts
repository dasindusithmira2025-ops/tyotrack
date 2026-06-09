import * as XLSX from "xlsx";
import { DateTime } from "luxon";
import type { IndividualEmployeeReportRow } from "@/lib/reporting";

const REPORT_HEADERS = [
  "Date",
  "Employee",
  "Project",
  "Location",
  "Start Time",
  "End Time",
  "Total Hours",
  "Evening Hours",
  "Night Hours",
  "Total Hours (Summed)",
  "Evening Hours (Summed)",
  "Night Hours (Summed)"
];

export function buildEmployeeHoursWorkbook(rows: IndividualEmployeeReportRow[]): Buffer {
  const data = rows.map((row) => [
    row.date,
    row.user.name,
    row.projectName,
    row.locationName,
    DateTime.fromISO(row.startTime).setZone("Europe/Helsinki").toFormat("HH:mm"),
    DateTime.fromISO(row.endTime).setZone("Europe/Helsinki").toFormat("HH:mm"),
    row.totalHours,
    row.eveningHours,
    row.nightHours,
    row.totalHoursSummed,
    row.eveningHoursSummed,
    row.nightHoursSummed
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([REPORT_HEADERS, ...data]);

  sheet["!cols"] = [
    { wch: 12 },
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
    { wch: 22 },
    { wch: 22 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 22 },
    { wch: 24 },
    { wch: 22 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Employee Hours");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
