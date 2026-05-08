export const RESERVATION_STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

export type ReservationStatusValue = (typeof RESERVATION_STATUS)[keyof typeof RESERVATION_STATUS];

export const RESERVATION_SOURCE = {
  WEB: "web",
  WHATSAPP: "whatsapp",
  PHONE: "llamada",
  INSTAGRAM: "instagram",
  FACEBOOK: "facebook",
  CRM: "crm",
  IN_PERSON: "presencial",
  OTHER: "otro",
} as const;

export type ReservationSourceValue = (typeof RESERVATION_SOURCE)[keyof typeof RESERVATION_SOURCE];

export const RESERVATION_SOURCE_VALUES = Object.values(RESERVATION_SOURCE) as [
  ReservationSourceValue,
  ...ReservationSourceValue[],
];

export const ADMIN_ROLE = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
} as const;

export type AdminRoleValue = (typeof ADMIN_ROLE)[keyof typeof ADMIN_ROLE];

export const SESSION_COOKIE_NAME = "reservastauras_session";
