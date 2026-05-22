// Allowlist de mensajes que el server puede mostrar al cliente vía
// `?error=<key>` o `?ok=<key>`. Cualquier valor que no esté en estos
// diccionarios se ignora silenciosamente: previene phishing visual del
// estilo `/admin/login?error=Hacé+click+acá:+https://evil.com`.
//
// Reglas:
// - Las keys son cortas, opacas y estables (kebab-case).
// - Los mensajes están del lado del server; el cliente sólo recibe la key.
// - Nuevas variantes de error agregan key + mensaje acá; nunca texto libre
//   en el redirect.

import { parsePublicLanguage } from "@/lib/i18n/language";
import type { PublicLanguage } from "@/lib/i18n/language";

export const PUBLIC_ERROR_MESSAGES = {
  es: {
    "invalid-data": "Datos inválidos. Revisá el formulario.",
    "rate-limited": "Demasiadas solicitudes desde tu conexión. Esperá un momento antes de volver a intentar.",
  },
  en: {
    "invalid-data": "Invalid details. Please review the form.",
    "rate-limited": "Too many requests from your connection. Please wait a moment before trying again.",
  },
} as const;

export type PublicMessageDictionary = Record<PublicLanguage, Record<string, string>>;
export type PublicErrorKey = keyof (typeof PUBLIC_ERROR_MESSAGES)["es"];

export const LOGIN_ERROR_MESSAGES = {
  "invalid-credentials": "Credenciales inválidas.",
  "throttled": "Demasiados intentos. Probá en unos minutos.",
  "invalid-data": "Login inválido.",
} as const;

export type LoginErrorKey = keyof typeof LOGIN_ERROR_MESSAGES;

export const ADMIN_ERROR_MESSAGES = {
  "invalid-request": "Solicitud inválida. Recargá la página e intentá nuevamente.",
  "invalid-reservation": "Reserva inválida.",
} as const;

export type AdminErrorKey = keyof typeof ADMIN_ERROR_MESSAGES;

export const ADMIN_USERS_ERROR_MESSAGES = {
  "invalid-request": "Solicitud inválida. Recargá la página e intentá nuevamente.",
  "invalid-data": "Datos inválidos. Revisá el formulario.",
  "invalid-admin": "Admin inválido.",
  "self-disable": "No podés desactivar tu propio usuario.",
  "admin-not-found": "Admin no encontrado.",
  "admin-email-exists": "Ya existe un admin con ese email.",
} as const;

export type AdminUsersErrorKey = keyof typeof ADMIN_USERS_ERROR_MESSAGES;

export const RESERVATION_DETAIL_ERROR_MESSAGES = {
  "invalid-request": "Solicitud inválida. Recargá la página e intentá nuevamente.",
  "not-found": "Reserva no encontrada.",
  "invalid-state-confirm": "La reserva no puede confirmarse desde su estado actual.",
  "invalid-state-reject": "La reserva no puede rechazarse.",
  "invalid-state-cancel": "La reserva no puede cancelarse desde su estado actual.",
  "invalid-state-resend": "Solo se puede reenviar el email cuando la reserva está confirmada.",
  "concurrent-update": "No pudimos confirmar la reserva por una actualización concurrente. Intentá nuevamente.",
  "email-resend-failed": "No pudimos reenviar el email. Revisá el detalle del error en la reserva.",
} as const;

export type ReservationDetailErrorKey = keyof typeof RESERVATION_DETAIL_ERROR_MESSAGES;

export const MANUAL_RESERVATION_ERROR_MESSAGES = {
  "invalid-request": "Solicitud inválida. Recargá la página e intentá nuevamente.",
  "invalid-data": "Datos inválidos. Revisá el formulario.",
} as const;

export type ManualReservationErrorKey = keyof typeof MANUAL_RESERVATION_ERROR_MESSAGES;

export const PHOTO_SUCCESS_MESSAGES = {
  "photo-uploaded": "Foto subida correctamente.",
  "photo-deleted": "Foto eliminada correctamente.",
} as const;

export type PhotoSuccessKey = keyof typeof PHOTO_SUCCESS_MESSAGES;

export const PHOTO_ERROR_MESSAGES = {
  "invalid-data": "Datos inválidos. Revisá el formulario.",
  "photo-too-large": "El archivo supera los 10MB.",
  "unsupported-photo": "Formato no soportado. Usá JPEG, PNG o WebP.",
  "not-found": "Foto no encontrada.",
} as const;

export type PhotoErrorKey = keyof typeof PHOTO_ERROR_MESSAGES;

export const CHANGE_PASSWORD_SUCCESS_MESSAGES = {
  "password-changed": "Contraseña actualizada correctamente.",
} as const;

export type ChangePasswordSuccessKey = keyof typeof CHANGE_PASSWORD_SUCCESS_MESSAGES;

export const CHANGE_PASSWORD_ERROR_MESSAGES = {
  "invalid-request": "Solicitud inválida. Recargá la página e intentá nuevamente.",
  "invalid-data": "Datos inválidos. Revisá el formulario.",
  "wrong-current-password": "La contraseña actual no es correcta.",
} as const;

export type ChangePasswordErrorKey = keyof typeof CHANGE_PASSWORD_ERROR_MESSAGES;

// Helper genérico: devuelve el mensaje si la key está en el diccionario,
// `null` en caso contrario. Las páginas usan esto para evitar pintar texto
// arbitrario que venga de la URL.
export function lookupMessage<T extends Record<string, string>>(
  dict: T,
  key: string | undefined,
): string | null {
  if (!key) return null;
  if (Object.prototype.hasOwnProperty.call(dict, key)) {
    return dict[key as keyof T];
  }
  return null;
}

export function lookupPublicMessage<T extends PublicMessageDictionary>(
  dict: T,
  key: string | undefined,
  language: unknown,
): string | null {
  if (!key) return null;

  const messages = dict[parsePublicLanguage(language)];
  if (Object.prototype.hasOwnProperty.call(messages, key)) {
    return messages[key];
  }

  return null;
}
