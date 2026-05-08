import { describe, expect, it } from "vitest";
import {
  EXPORT_DEFAULT_LIMIT,
  EXPORT_MAX_LIMIT,
  buildReservationWhere,
  parseExportFilters,
} from "@/lib/reservations/export-filters";

function params(q: Record<string, string>): URLSearchParams {
  return new URLSearchParams(q);
}

describe("parseExportFilters", () => {
  it("defaults format to xlsx when missing", () => {
    const result = parseExportFilters(params({}));
    expect(result.ok).toBe(true);
    expect(result.data?.format).toBe("xlsx");
  });

  it("accepts json/xlsx/pdf as valid formats", () => {
    for (const fmt of ["json", "xlsx", "pdf"]) {
      const r = parseExportFilters(params({ format: fmt }));
      expect(r.ok, `format ${fmt} should be ok`).toBe(true);
      expect(r.data?.format).toBe(fmt);
    }
  });

  it("rejects an unknown format with 400-ready error", () => {
    const r = parseExportFilters(params({ format: "csv" }));
    expect(r.ok).toBe(false);
    expect(r.error).toBeDefined();
  });

  it("rejects malformed dates", () => {
    const r = parseExportFilters(params({ from: "2026/01/01" }));
    expect(r.ok).toBe(false);
  });

  it("parses a valid date range", () => {
    const r = parseExportFilters(params({ from: "2026-01-01", to: "2026-01-31" }));
    expect(r.ok).toBe(true);
    expect(r.data?.from?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(r.data?.to?.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("rejects inverted date range", () => {
    const r = parseExportFilters(params({ from: "2026-02-01", to: "2026-01-01" }));
    expect(r.ok).toBe(false);
  });

  it("accepts known reservation statuses", () => {
    for (const status of ["PENDING", "CONFIRMED", "REJECTED", "CANCELLED"]) {
      const r = parseExportFilters(params({ status }));
      expect(r.ok, `status ${status} should be ok`).toBe(true);
      expect(r.data?.status).toBe(status);
    }
  });

  it("rejects unknown status", () => {
    const r = parseExportFilters(params({ status: "DELETED" }));
    expect(r.ok).toBe(false);
  });

  it("rejects negative or zero limits", () => {
    expect(parseExportFilters(params({ limit: "0" })).ok).toBe(false);
    expect(parseExportFilters(params({ limit: "-3" })).ok).toBe(false);
  });

  it("rejects limit above EXPORT_MAX_LIMIT", () => {
    const r = parseExportFilters(params({ limit: String(EXPORT_MAX_LIMIT + 1) }));
    expect(r.ok).toBe(false);
  });

  it("accepts limit at the boundary", () => {
    const r = parseExportFilters(params({ limit: String(EXPORT_MAX_LIMIT) }));
    expect(r.ok).toBe(true);
    expect(r.data?.limit).toBe(EXPORT_MAX_LIMIT);
  });

  it("leaves limit undefined when absent so the route can apply EXPORT_DEFAULT_LIMIT", () => {
    const r = parseExportFilters(params({}));
    expect(r.ok).toBe(true);
    expect(r.data?.limit).toBeUndefined();
    expect(EXPORT_DEFAULT_LIMIT).toBeGreaterThan(0);
  });
});

describe("buildReservationWhere", () => {
  it("returns an empty clause when no filters are set", () => {
    const where = buildReservationWhere({ format: "xlsx" });
    expect(where).toEqual({});
  });

  it("uses gte for 'from' and end-of-day lte for 'to' so the last day is included", () => {
    const where = buildReservationWhere({
      format: "xlsx",
      from: new Date("2026-05-01T00:00:00.000Z"),
      to: new Date("2026-05-31T00:00:00.000Z"),
    });
    expect(where.reservationDate?.gte?.toISOString()).toBe("2026-05-01T00:00:00.000Z");
    expect(where.reservationDate?.lte?.toISOString()).toBe("2026-05-31T23:59:59.999Z");
  });

  it("forwards status verbatim", () => {
    const where = buildReservationWhere({ format: "xlsx", status: "CONFIRMED" });
    expect(where.status).toBe("CONFIRMED");
  });

  it("only sets reservationDate when at least one bound is present", () => {
    const onlyFrom = buildReservationWhere({
      format: "xlsx",
      from: new Date("2026-05-01T00:00:00.000Z"),
    });
    expect(onlyFrom.reservationDate?.gte).toBeInstanceOf(Date);
    expect(onlyFrom.reservationDate?.lte).toBeUndefined();

    const onlyTo = buildReservationWhere({
      format: "xlsx",
      to: new Date("2026-05-31T00:00:00.000Z"),
    });
    expect(onlyTo.reservationDate?.gte).toBeUndefined();
    expect(onlyTo.reservationDate?.lte).toBeInstanceOf(Date);
  });
});
