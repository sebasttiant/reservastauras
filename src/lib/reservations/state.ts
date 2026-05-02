import { RESERVATION_STATUS, type ReservationStatusValue } from "@/lib/constants";

export function canTransitionReservation(
  from: ReservationStatusValue,
  to: ReservationStatusValue,
): boolean {
  if (from === to) return true;

  if (from === RESERVATION_STATUS.PENDING) {
    return to === RESERVATION_STATUS.CONFIRMED || to === RESERVATION_STATUS.REJECTED || to === RESERVATION_STATUS.CANCELLED;
  }

  if (from === RESERVATION_STATUS.CONFIRMED) {
    return to === RESERVATION_STATUS.CANCELLED;
  }

  return false;
}
