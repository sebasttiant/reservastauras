import { RESERVATION_STATUS, type ReservationStatusValue } from "@/lib/constants";

export interface ReservationSlot {
  reservationDate: Date;
  reservationTime: string;
  area: string | null;
}

export interface ExistingReservationSlot extends ReservationSlot {
  id: string;
  status: ReservationStatusValue;
}

function sameCalendarDate(left: Date, right: Date): boolean {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

export function slotsOverlap(left: ReservationSlot, right: ReservationSlot): boolean {
  const sameDate = sameCalendarDate(left.reservationDate, right.reservationDate);
  const sameTime = left.reservationTime === right.reservationTime;
  const sameArea = left.area === null && right.area === null ? true : left.area === right.area;

  return sameDate && sameTime && sameArea;
}

export function hasConfirmedOverlap(
  candidate: ReservationSlot,
  existing: ExistingReservationSlot[],
  ignoredReservationId?: string,
): boolean {
  return existing.some((reservation) => {
    if (reservation.id === ignoredReservationId) return false;
    if (reservation.status !== RESERVATION_STATUS.CONFIRMED) return false;
    return slotsOverlap(candidate, reservation);
  });
}
