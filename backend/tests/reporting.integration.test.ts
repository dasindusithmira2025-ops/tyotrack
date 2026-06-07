import { describe, expect, it } from "vitest";
import { aggregateReport, formatDailyEmployeeSummaryRows } from "@/lib/reporting";
import { buildEmployeeHoursWorkbook } from "@/lib/report-export";
import * as XLSX from "xlsx";

describe("Reporting", () => {
  it("aggregates totals", () => {
    const result = aggregateReport([
      { totalHours: 2.5, eveningHours: 1, nightHours: 0 },
      { totalHours: 4, eveningHours: 0.5, nightHours: 1.25 }
    ]);

    expect(result.totalHours).toBe(6.5);
    expect(result.eveningHours).toBe(1.5);
    expect(result.nightHours).toBe(1.25);
  });

  it("handles null and missing hour values", () => {
    const result = aggregateReport([
      { totalHours: null, eveningHours: undefined, nightHours: 0 },
      { totalHours: 3, eveningHours: 1.25, nightHours: null }
    ]);

    expect(result.totalHours).toBe(3);
    expect(result.eveningHours).toBe(1.25);
    expect(result.nightHours).toBe(0);
  });

  it("formats daily employee summaries from date and employee groups", () => {
    const result = formatDailyEmployeeSummaryRows(
      [
        {
          localDate: "2026-05-28",
          userId: "employee-1",
          projectId: "project-1",
          _sum: {
            totalHours: 6.25,
            eveningHours: 3.25,
            nightHours: null
          }
        }
      ],
      [{ id: "employee-1", name: "Pasindu", email: "" }],
      [{ id: "project-1", name: "Project 1", workspace: { id: "location-1", name: "Location 1" } }]
    );

    expect(result).toEqual([
      {
        id: "2026-05-28:employee-1:location-1",
        date: "2026-05-28",
        userId: "employee-1",
        locationId: "location-1",
        locationName: "Location 1",
        totalHours: 6.25,
        eveningHours: 3.25,
        nightHours: 0,
        totalHoursSummed: 6.25,
        eveningHoursSummed: 3.25,
        nightHoursSummed: 0,
        user: {
          id: "employee-1",
          name: "Pasindu",
          email: ""
        }
      }
    ]);
  });

  it("sums duplicate daily employee groups across locations", () => {
    const result = formatDailyEmployeeSummaryRows(
      [
        {
          localDate: "2026-05-28",
          userId: "employee-1",
          projectId: "project-1",
          _sum: {
            totalHours: 5,
            eveningHours: 1.5,
            nightHours: 0
          }
        },
        {
          localDate: "2026-05-28",
          userId: "employee-1",
          projectId: "project-2",
          _sum: {
            totalHours: 3.25,
            eveningHours: 0.75,
            nightHours: 1.25
          }
        }
      ],
      [{ id: "employee-1", name: "Pasindu", email: "" }],
      [
        { id: "project-1", name: "Project 1", workspace: { id: "location-1", name: "Location 1" } },
        { id: "project-2", name: "Project 2", workspace: { id: "location-2", name: "Location 2" } }
      ]
    );

    expect(result).toEqual([
      {
        id: "2026-05-28:employee-1:location-1",
        date: "2026-05-28",
        userId: "employee-1",
        locationId: "location-1",
        locationName: "Location 1",
        totalHours: 5,
        eveningHours: 1.5,
        nightHours: 0,
        totalHoursSummed: 8.25,
        eveningHoursSummed: 2.25,
        nightHoursSummed: 1.25,
        user: {
          id: "employee-1",
          name: "Pasindu",
          email: ""
        }
      },
      {
        id: "2026-05-28:employee-1:location-2",
        date: "2026-05-28",
        userId: "employee-1",
        locationId: "location-2",
        locationName: "Location 2",
        totalHours: 3.25,
        eveningHours: 0.75,
        nightHours: 1.25,
        totalHoursSummed: 8.25,
        eveningHoursSummed: 2.25,
        nightHoursSummed: 1.25,
        user: {
          id: "employee-1",
          name: "Pasindu",
          email: ""
        }
      }
    ]);
  });

  it("combines projects in the same location before calculating daily summed values", () => {
    const result = formatDailyEmployeeSummaryRows(
      [
        {
          localDate: "2026-05-28",
          userId: "employee-1",
          projectId: "project-1",
          _sum: { totalHours: 2, eveningHours: 1, nightHours: 0 }
        },
        {
          localDate: "2026-05-28",
          userId: "employee-1",
          projectId: "project-2",
          _sum: { totalHours: 3, eveningHours: 0.5, nightHours: 1 }
        }
      ],
      [{ id: "employee-1", name: "Pasindu", email: "" }],
      [
        { id: "project-1", workspace: { id: "location-1", name: "Location 1" } },
        { id: "project-2", workspace: { id: "location-1", name: "Location 1" } }
      ]
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      locationName: "Location 1",
      totalHours: 5,
      eveningHours: 1.5,
      nightHours: 1,
      totalHoursSummed: 5,
      eveningHoursSummed: 1.5,
      nightHoursSummed: 1
    });
  });

  it("uses the location captured on the time entry instead of a project's current location", () => {
    const result = formatDailyEmployeeSummaryRows(
      [
        {
          localDate: "2026-05-28",
          userId: "employee-1",
          projectId: "project-1",
          workspaceId: "original-location",
          workspaceName: "Original Location",
          _sum: { totalHours: 4, eveningHours: 0, nightHours: 0 }
        }
      ],
      [{ id: "employee-1", name: "Pasindu", email: "" }],
      [{ id: "project-1", workspace: { id: "new-location", name: "New Location" } }]
    );

    expect(result[0]).toMatchObject({
      locationId: "original-location",
      locationName: "Original Location"
    });
  });

  it("exports location and summed fields as numeric Excel columns", () => {
    const rows = formatDailyEmployeeSummaryRows(
      [
        {
          localDate: "2026-05-28",
          userId: "employee-1",
          projectId: "project-1",
          _sum: { totalHours: 2.5, eveningHours: 1, nightHours: 0.5 }
        }
      ],
      [{ id: "employee-1", name: "Pasindu", email: "" }],
      [{ id: "project-1", workspace: { id: "location-1", name: "Location 1" } }]
    );

    const workbook = XLSX.read(buildEmployeeHoursWorkbook(rows), { type: "buffer" });
    const sheet = workbook.Sheets["Employee Hours"];
    const values = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

    expect(values[0]).toEqual([
      "Date",
      "Employee",
      "Location",
      "Total Hours",
      "Evening Hours",
      "Night Hours",
      "Total Hours (Summed)",
      "Evening Hours (Summed)",
      "Night Hours (Summed)"
    ]);
    expect(values[1]).toEqual(["2026-05-28", "Pasindu", "Location 1", 2.5, 1, 0.5, 2.5, 1, 0.5]);
  });
});
