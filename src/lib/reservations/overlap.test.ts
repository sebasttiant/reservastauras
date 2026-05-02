import { describe, expect, it } from "vitest";
import { RESERVATION_STATUS } from "@/lib/constants";
import { hasConfirmedOverlap } from "@/lib/reservations/overlap";

describe("hasConfirmedOverlap", () => {
  it("detects a confirmed overlap for same date, time and area", () => {
    const candidate = { reservationDate: new Date("2026-06-10T00:00:00Z"), reservationTime: "20:00", area: "Patio" };

    expect(hasConfirmedOverlap(candidate, [
      { id: "1", ...candidate, status: RESERVATION_STATUS.CONFIRMED },
    ])).toBe(true);
  });

  it("does not overlap different areas", () => {
    const candidate = { reservationDate: new Date("2026-06-10T00:00:00Z"), reservationTime: "20:00", area: "Patio" };

    expect(hasConfirmedOverlap(candidate, [
      { id: "1", reservationDate: candidate.reservationDate, reservationTime: "20:00", area: "Salón", status: RESERVATION_STATUS.CONFIRMED },
    ])).toBe(false);
  });

  it("uses date and time when both reservations have no area", () => {
    const candidate = { reservationDate: new Date("2026-06-10T00:00:00Z"), reservationTime: "20:00", area: null };

    expect(hasConfirmedOverlap(candidate, [
      { id: "1", ...candidate, status: RESERVATION_STATUS.CONFIRMED },
    ])).toBe(true);
  });
});
