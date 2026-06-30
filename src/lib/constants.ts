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
  RESERVATION_OPERATOR: "RESERVATION_OPERATOR",
} as const;

// Human-facing label per role. Kept here so UI never hardcodes role copy.
export const ADMIN_ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  RESERVATION_OPERATOR: "Operador de reservas",
} as const satisfies Record<AdminRoleValue, string>;

export type AdminRoleValue = (typeof ADMIN_ROLE)[keyof typeof ADMIN_ROLE];

export const SESSION_COOKIE_NAME = "reservastauras_session";
