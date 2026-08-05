import { describe, expect, it } from "vitest";
import {
  formatBusinessDateForFilename,
  formatBusinessIssueDate,
  formatReservationActionDateTime,
  formatReservationDate,
} from "@/lib/reservations/business-date";

describe("formatReservationActionDateTime", () => {
  it("renders UTC instants in Colombia time, including the prior calendar date", () => {
    const formatted = formatReservationActionDateTime(new Date("2026-08-04T00:23:22.939Z"));

    expect(formatted).toMatch(/3 de agosto de 2026/i);
    expect(formatted).toMatch(/7:23/);
    expect(formatted).toMatch(/p\.\s?m\./i);
  });

  it("preserves the calendar date of Prisma date-only values", () => {
    expect(formatReservationDate(new Date("2026-08-04T00:00:00.000Z"))).toBe("04/08/2026");
  });

  it("uses Colombia's date for issue labels and business-facing filenames", () => {
    const instant = new Date("2026-08-04T00:23:22.939Z");

    expect(formatBusinessIssueDate(instant)).toMatch(/3 de agosto de 2026/i);
    expect(formatBusinessDateForFilename(instant)).toBe("2026-08-03");
  });
});
