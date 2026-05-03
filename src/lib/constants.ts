export const RESERVATION_STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

export type ReservationStatusValue = (typeof RESERVATION_STATUS)[keyof typeof RESERVATION_STATUS];

export const ADMIN_ROLE = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
} as const;

export type AdminRoleValue = (typeof ADMIN_ROLE)[keyof typeof ADMIN_ROLE];

export const SESSION_COOKIE_NAME = "reservastauras_session";
