import { describe, expect, it } from "vitest";
import { RESERVATION_STATUS } from "@/lib/constants";
import { canTransitionReservation } from "@/lib/reservations/state";

describe("canTransitionReservation", () => {
  it("allows pending reservations to be confirmed, rejected or cancelled", () => {
    expect(canTransitionReservation(RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED)).toBe(true);
    expect(canTransitionReservation(RESERVATION_STATUS.PENDING, RESERVATION_STATUS.REJECTED)).toBe(true);
    expect(canTransitionReservation(RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CANCELLED)).toBe(true);
  });

  it("allows confirmed reservations to be cancelled but never reverted to pending", () => {
    expect(canTransitionReservation(RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.CANCELLED)).toBe(true);
    expect(canTransitionReservation(RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.PENDING)).toBe(false);
    expect(canTransitionReservation(RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.REJECTED)).toBe(false);
  });

  it("treats rejected and cancelled as terminal states", () => {
    expect(canTransitionReservation(RESERVATION_STATUS.REJECTED, RESERVATION_STATUS.CONFIRMED)).toBe(false);
    expect(canTransitionReservation(RESERVATION_STATUS.REJECTED, RESERVATION_STATUS.PENDING)).toBe(false);
    expect(canTransitionReservation(RESERVATION_STATUS.CANCELLED, RESERVATION_STATUS.CONFIRMED)).toBe(false);
    expect(canTransitionReservation(RESERVATION_STATUS.CANCELLED, RESERVATION_STATUS.PENDING)).toBe(false);
  });

  it("treats same-state as a no-op transition", () => {
    expect(canTransitionReservation(RESERVATION_STATUS.PENDING, RESERVATION_STATUS.PENDING)).toBe(true);
    expect(canTransitionReservation(RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.CONFIRMED)).toBe(true);
  });
});
