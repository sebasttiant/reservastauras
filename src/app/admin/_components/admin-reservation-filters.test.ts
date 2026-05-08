import { describe, expect, it } from "vitest";
import { buildAdminFilterHref } from "./admin-reservation-filters-url";

describe("buildAdminFilterHref", () => {
  it("keeps the active status while applying search and exact date filters", () => {
    const href = buildAdminFilterHref({
      status: "CONFIRMED",
      query: "Laura",
      date: "2026-05-08",
    });

    expect(href).toBe("/admin?status=CONFIRMED&q=Laura&date=2026-05-08");
  });

  it("removes empty search and date filters from the URL", () => {
    const href = buildAdminFilterHref({
      status: "PENDING",
      query: "   ",
      date: "",
    });

    expect(href).toBe("/admin?status=PENDING");
  });

  it("returns the base admin URL when all filters are empty", () => {
    const href = buildAdminFilterHref({
      status: undefined,
      query: "",
      date: "",
    });

    expect(href).toBe("/admin");
  });
});
