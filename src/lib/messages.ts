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

export const PUBLIC_ERROR_MESSAGES = {
  "invalid-data": "Datos inválidos. Revisá el formulario.",
  "rate-limited": "Demasiadas solicitudes desde tu conexión. Esperá un momento antes de volver a intentar.",
} as const;

export type PublicErrorKey = keyof typeof PUBLIC_ERROR_MESSAGES;

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
  "concurrent-update": "No pudimos confirmar la reserva por una actualización concurrente. Intentá nuevamente.",
} as const;

export type ReservationDetailErrorKey = keyof typeof RESERVATION_DETAIL_ERROR_MESSAGES;

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
