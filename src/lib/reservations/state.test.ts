import { describe, expect, it } from "vitest";
import { RESERVATION_STATUS } from "@/lib/constants";
import { canTransitionReservation } from "@/lib/reservations/state";

describe("canTransitionReservation", () => {
  it("allows pending reservations to be confirmed or rejected", () => {
    expect(canTransitionReservation(RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED)).toBe(true);
    expect(canTransitionReservation(RESERVATION_STATUS.PENDING, RESERVATION_STATUS.REJECTED)).toBe(true);
  });

  it("prevents rejected reservations from being confirmed later", () => {
    expect(canTransitionReservation(RESERVATION_STATUS.REJECTED, RESERVATION_STATUS.CONFIRMED)).toBe(false);
  });
});
