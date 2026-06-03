import { describe, expect, it } from "vitest";
import { aggregateReport, formatDailyEmployeeSummaryRows } from "@/lib/reporting";

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
          _sum: {
            totalHours: 6.25,
            eveningHours: 3.25,
            nightHours: null
          }
        }
      ],
      [{ id: "employee-1", name: "Pasindu", email: "" }]
    );

    expect(result).toEqual([
      {
        id: "2026-05-28:employee-1",
        date: "2026-05-28",
        userId: "employee-1",
        totalHours: 6.25,
        eveningHours: 3.25,
        nightHours: 0,
        user: {
          id: "employee-1",
          name: "Pasindu",
          email: ""
        }
      }
    ]);
  });
});
