import { describe, expect, it } from "vitest";
import {
  EXPORT_DEFAULT_LIMIT,
  EXPORT_MAX_LIMIT,
  EXPORT_QUERY_MAX_LENGTH,
  buildReservationWhere,
  isOpenExport,
  parseExportFilters,
  summarizeFilters,
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

  it("expands `date` (exact match) to a closed same-day range", () => {
    const where = buildReservationWhere({
      format: "xlsx",
      date: new Date("2026-05-08T00:00:00.000Z"),
    });
    expect(where.reservationDate?.gte?.toISOString()).toBe("2026-05-08T00:00:00.000Z");
    expect(where.reservationDate?.lte?.toISOString()).toBe("2026-05-08T23:59:59.999Z");
  });

  it("forwards `q` as a Prisma OR over name/email/phone/area, all case-insensitive", () => {
    const where = buildReservationWhere({ format: "xlsx", q: "Laura" });
    expect(where.OR).toBeDefined();
    expect(where.OR).toHaveLength(4);
    expect(where.OR).toEqual([
      { user: { name: { contains: "Laura", mode: "insensitive" } } },
      { user: { email: { contains: "Laura", mode: "insensitive" } } },
      { user: { phone: { contains: "Laura", mode: "insensitive" } } },
      { area: { contains: "Laura", mode: "insensitive" } },
    ]);
  });
});

describe("parseExportFilters — `q` and `date` filters", () => {
  function params(q: Record<string, string>): URLSearchParams {
    return new URLSearchParams(q);
  }

  it("trims whitespace around `q` and forwards it", () => {
    const r = parseExportFilters(params({ q: "  Laura  " }));
    expect(r.ok).toBe(true);
    expect(r.data?.q).toBe("Laura");
  });

  it("treats whitespace-only `q` as absent (no 400)", () => {
    const r = parseExportFilters(params({ q: "   " }));
    expect(r.ok).toBe(true);
    expect(r.data?.q).toBeUndefined();
  });

  it("rejects `q` longer than EXPORT_QUERY_MAX_LENGTH", () => {
    const long = "a".repeat(EXPORT_QUERY_MAX_LENGTH + 1);
    const r = parseExportFilters(params({ q: long }));
    expect(r.ok).toBe(false);
  });

  it("accepts `q` at the boundary length", () => {
    const r = parseExportFilters(params({ q: "a".repeat(EXPORT_QUERY_MAX_LENGTH) }));
    expect(r.ok).toBe(true);
    expect(r.data?.q?.length).toBe(EXPORT_QUERY_MAX_LENGTH);
  });

  it("parses a valid `date` value", () => {
    const r = parseExportFilters(params({ date: "2026-05-08" }));
    expect(r.ok).toBe(true);
    expect(r.data?.date?.toISOString()).toBe("2026-05-08T00:00:00.000Z");
  });

  it("rejects `date` if `from` or `to` are also present", () => {
    const both = parseExportFilters(params({ date: "2026-05-08", from: "2026-05-01" }));
    expect(both.ok).toBe(false);
    const all = parseExportFilters(params({ date: "2026-05-08", from: "2026-05-01", to: "2026-05-31" }));
    expect(all.ok).toBe(false);
  });
});

describe("summarizeFilters", () => {
  it("returns Desde/Hasta rows when no exact date is set, with em dash for missing bounds", () => {
    const rows = summarizeFilters({ format: "xlsx" });
    expect(rows).toEqual([
      { label: "Desde", value: "—" },
      { label: "Hasta", value: "—" },
      { label: "Estado", value: "Todos" },
      { label: "Búsqueda", value: "—" },
    ]);
  });

  it("returns 'Fecha exacta' instead of Desde/Hasta when date is set", () => {
    const rows = summarizeFilters({
      format: "xlsx",
      date: new Date("2026-05-08T00:00:00.000Z"),
    });
    expect(rows[0]).toEqual({ label: "Fecha exacta", value: "2026-05-08" });
    expect(rows.find((r) => r.label === "Desde")).toBeUndefined();
    expect(rows.find((r) => r.label === "Hasta")).toBeUndefined();
  });

  it("translates status into a human label", () => {
    const rows = summarizeFilters({ format: "xlsx", status: "CONFIRMED" });
    expect(rows.find((r) => r.label === "Estado")?.value).toBe("Confirmadas");
  });

  it("includes the search term verbatim", () => {
    const rows = summarizeFilters({ format: "xlsx", q: "Laura" });
    expect(rows.find((r) => r.label === "Búsqueda")?.value).toBe("Laura");
  });
});

describe("isOpenExport", () => {
  it("is true when no narrowing filter is set", () => {
    expect(isOpenExport({ format: "xlsx" })).toBe(true);
  });

  it("is false when any of from/to/date/status/q is present", () => {
    expect(isOpenExport({ format: "xlsx", status: "CONFIRMED" })).toBe(false);
    expect(isOpenExport({ format: "xlsx", q: "Laura" })).toBe(false);
    expect(
      isOpenExport({ format: "xlsx", date: new Date("2026-05-08T00:00:00.000Z") }),
    ).toBe(false);
    expect(
      isOpenExport({ format: "xlsx", from: new Date("2026-05-01T00:00:00.000Z") }),
    ).toBe(false);
    expect(
      isOpenExport({ format: "xlsx", to: new Date("2026-05-31T00:00:00.000Z") }),
    ).toBe(false);
  });
});
