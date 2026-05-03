import { describe, expect, it } from "vitest";
import { RESERVATION_STATUS } from "@/lib/constants";
import { hasConfirmedOverlap } from "@/lib/reservations/overlap";

const date = new Date("2026-06-10T00:00:00Z");

describe("hasConfirmedOverlap", () => {
  it("detects a confirmed overlap for same date, time and area", () => {
    expect(hasConfirmedOverlap(
      { reservationDate: date, reservationTime: "20:00", area: "Patio" },
      [{ id: "1", reservationDate: date, reservationTime: "20:00", area: "Patio", status: RESERVATION_STATUS.CONFIRMED }],
    )).toBe(true);
  });

  it("does not overlap when areas differ", () => {
    expect(hasConfirmedOverlap(
      { reservationDate: date, reservationTime: "20:00", area: "Patio" },
      [{ id: "1", reservationDate: date, reservationTime: "20:00", area: "Salón", status: RESERVATION_STATUS.CONFIRMED }],
    )).toBe(false);
  });

  it("collides only with other null-area reservations when area is null", () => {
    expect(hasConfirmedOverlap(
      { reservationDate: date, reservationTime: "20:00", area: null },
      [{ id: "1", reservationDate: date, reservationTime: "20:00", area: null, status: RESERVATION_STATUS.CONFIRMED }],
    )).toBe(true);

    expect(hasConfirmedOverlap(
      { reservationDate: date, reservationTime: "20:00", area: null },
      [{ id: "1", reservationDate: date, reservationTime: "20:00", area: "Patio", status: RESERVATION_STATUS.CONFIRMED }],
    )).toBe(false);
  });

  it("ignores non-confirmed reservations", () => {
    for (const status of [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.REJECTED, RESERVATION_STATUS.CANCELLED] as const) {
      expect(hasConfirmedOverlap(
        { reservationDate: date, reservationTime: "20:00", area: "Patio" },
        [{ id: "1", reservationDate: date, reservationTime: "20:00", area: "Patio", status }],
      )).toBe(false);
    }
  });

  it("ignores the reservation we are evaluating itself", () => {
    expect(hasConfirmedOverlap(
      { reservationDate: date, reservationTime: "20:00", area: "Patio" },
      [{ id: "self", reservationDate: date, reservationTime: "20:00", area: "Patio", status: RESERVATION_STATUS.CONFIRMED }],
      "self",
    )).toBe(false);
  });

  it("does not collide on different times even with same date and area", () => {
    expect(hasConfirmedOverlap(
      { reservationDate: date, reservationTime: "20:00", area: "Patio" },
      [{ id: "1", reservationDate: date, reservationTime: "21:00", area: "Patio", status: RESERVATION_STATUS.CONFIRMED }],
    )).toBe(false);
  });
});
