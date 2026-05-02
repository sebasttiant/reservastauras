export const RESERVATION_STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

export type ReservationStatusValue = (typeof RESERVATION_STATUS)[keyof typeof RESERVATION_STATUS];

export const SESSION_COOKIE_NAME = "reservastauras_session";
