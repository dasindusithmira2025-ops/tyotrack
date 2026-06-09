import { describe, expect, it } from "vitest";
import { aggregateReport, formatIndividualEmployeeReportRows, type IndividualEmployeeReportItem } from "@/lib/reporting";
import { buildEmployeeHoursWorkbook } from "@/lib/report-export";
import * as XLSX from "xlsx";

function reportItem(overrides: Partial<IndividualEmployeeReportItem> = {}): IndividualEmployeeReportItem {
  return {
    id: "split-1",
    localDate: "2026-05-28",
    userId: "employee-1",
    projectId: "project-1",
    startTime: "2026-05-28T15:00:00.000Z",
    endTime: "2026-05-28T16:30:00.000Z",
    totalHours: 1.5,
    eveningHours: 1.5,
    nightHours: 0,
    workspaceId: "location-1",
    workspaceName: "Location 1",
    user: { id: "employee-1", name: "Pasindu", email: "" },
    project: { id: "project-1", name: "Espresso House" },
    ...overrides
  };
}

describe("Reporting", () => {
  it("aggregates totals and handles missing values", () => {
    const result = aggregateReport([
      { totalHours: 2.5, eveningHours: 1, nightHours: null },
      { totalHours: 4, eveningHours: 0.5, nightHours: 1.25 }
    ]);

    expect(result).toEqual({ totalHours: 6.5, eveningHours: 1.5, nightHours: 1.25 });
  });

  it("preserves individual same-day records and repeats employee daily sums", () => {
    const rows = formatIndividualEmployeeReportRows([
      reportItem(),
      reportItem({
        id: "split-2",
        projectId: "project-2",
        project: { id: "project-2", name: "Synlab" },
        startTime: "2026-05-28T16:30:00.000Z",
        endTime: "2026-05-28T18:15:00.000Z",
        totalHours: 1.75,
        eveningHours: 1.75
      }),
      reportItem({
        id: "split-3",
        projectId: "project-3",
        project: { id: "project-3", name: "Extra Works" },
        startTime: "2026-05-28T10:00:00.000Z",
        endTime: "2026-05-28T13:00:00.000Z",
        totalHours: 3,
        eveningHours: 0
      })
    ]);

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.projectName)).toEqual(["Espresso House", "Synlab", "Extra Works"]);
    expect(rows.map((row) => row.totalHours)).toEqual([1.5, 1.75, 3]);
    expect(rows.map((row) => row.totalHoursSummed)).toEqual([6.25, 6.25, 6.25]);
    expect(rows.map((row) => row.eveningHoursSummed)).toEqual([3.25, 3.25, 3.25]);
    expect(rows.map((row) => row.nightHoursSummed)).toEqual([0, 0, 0]);
  });

  it("does not combine daily sums across employees or dates", () => {
    const rows = formatIndividualEmployeeReportRows([
      reportItem(),
      reportItem({
        id: "split-2",
        userId: "employee-2",
        user: { id: "employee-2", name: "Other Employee", email: "" },
        totalHours: 4
      }),
      reportItem({
        id: "split-3",
        localDate: "2026-05-29",
        totalHours: 3
      })
    ]);

    expect(rows.map((row) => row.totalHoursSummed)).toEqual([1.5, 4, 3]);
  });

  it("uses the location captured on the time entry", () => {
    const [row] = formatIndividualEmployeeReportRows([
      reportItem({ workspaceId: "original-location", workspaceName: "Original Location" })
    ]);

    expect(row).toMatchObject({
      locationId: "original-location",
      locationName: "Original Location"
    });
  });

  it("exports individual records and summed fields as numeric Excel columns", () => {
    const rows = formatIndividualEmployeeReportRows([reportItem()]);
    const workbook = XLSX.read(buildEmployeeHoursWorkbook(rows), { type: "buffer" });
    const sheet = workbook.Sheets["Employee Hours"];
    const values = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

    expect(values[0]).toEqual([
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
    ]);
    expect(values[1]).toEqual([
      "2026-05-28",
      "Pasindu",
      "Espresso House",
      "Location 1",
      "18:00",
      "19:30",
      1.5,
      1.5,
      0,
      1.5,
      1.5,
      0
    ]);
  });
});
