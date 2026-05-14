import { z } from "zod";
import { ADMIN_ROLE, RESERVATION_SOURCE_VALUES, RESERVATION_STATUS } from "@/lib/constants";
import { DEFAULT_PUBLIC_LANGUAGE, publicLanguageSchema } from "@/lib/i18n/language";

// Zona horaria del negocio. Las reglas calendario (hoy/ayer/futuro) se
// resuelven contra esta zona, no contra UTC ni la del proceso.
const BUSINESS_TIMEZONE = "America/Bogota";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function businessTodayDateString(): string {
  // en-CA produce siempre YYYY-MM-DD, comparable lexicográficamente.
  return DATE_FORMATTER.format(new Date());
}

function isTodayOrLaterInBusinessZone(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return value >= businessTodayDateString();
}

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Usá una fecha válida." })
  .refine(isTodayOrLaterInBusinessZone, { error: "La fecha debe ser hoy o futura." });

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Usá un horario HH:mm válido." });

const checkboxSchema = z.literal("on", {
  error: "Debés aceptar este punto para continuar.",
});

const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => /^\d{7,15}$/.test(value), {
    error: "Ingresá un teléfono válido de 7 a 15 dígitos.",
  });

export const reservationRequestSchema = z.object({
  name: z.string().trim().min(2, { error: "Ingresá tu nombre." }).max(120),
  email: z.email({ error: "Ingresá un email válido." }).transform((value) => value.toLowerCase()),
  phone: phoneSchema,
  country: z.string().trim().min(2, { error: "Seleccioná tu país." }).max(80),
  reservationDate: dateOnlySchema,
  reservationTime: timeSchema,
  area: z.string().trim().max(80).optional(),
  reason: z.string().trim().min(2, { error: "Seleccioná el motivo de la reserva." }).max(80),
  partySize: z.coerce
    .number({ error: "Indicá cuántas personas." })
    .int({ error: "La cantidad de personas debe ser entera." })
    .min(1, { error: "Mínimo 1 persona." })
    .max(30, { error: "Máximo 30 personas." }),
  notes: z.string().trim().max(500).optional(),
  isAdult: checkboxSchema,
  dataConsent: checkboxSchema,
  // Deploy-safe: callers anteriores (formulario actual sin idioma) siguen
  // funcionando porque el campo ausente cae al default `"en"`. Pero un valor
  // explícito no soportado (ej. `"foo"`) DEBE fallar para no persistir ni
  // “corregir” idiomas inválidos en silencio. El mensaje de Zod queda interno:
  // el cliente recibe la key opaca `invalid-data` desde la action, no este texto.
  customerLanguage: publicLanguageSchema.default(DEFAULT_PUBLIC_LANGUAGE),
});

export const loginSchema = z.object({
  email: z.email({ error: "Email inválido." }).transform((value) => value.toLowerCase()),
  password: z.string().min(8, { error: "La contraseña debe tener al menos 8 caracteres." }),
});

export const createAdminSchema = z.object({
  name: z.string().trim().min(2, { error: "Ingresá el nombre del admin." }).max(120),
  email: z.email({ error: "Email inválido." }).transform((value) => value.toLowerCase()),
  password: z.string().min(10, { error: "La contraseña debe tener al menos 10 caracteres." }),
  role: z.enum([ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.ADMIN], { error: "Rol inválido." }),
});

export const manualReservationSchema = z.object({
  name: z.string().trim().min(2, { error: "Ingresá el nombre del cliente." }).max(120),
  email: z.email({ error: "Email inválido." }).transform((value) => value.toLowerCase()),
  phone: phoneSchema,
  reservationDate: dateOnlySchema,
  reservationTime: timeSchema,
  area: z.string().trim().max(80).optional(),
  partySize: z.coerce
    .number({ error: "Indicá cuántas personas." })
    .int({ error: "La cantidad de personas debe ser entera." })
    .min(1, { error: "Mínimo 1 persona." })
    .max(30, { error: "Máximo 30 personas." }),
  source: z.enum(RESERVATION_SOURCE_VALUES, { error: "Origen inválido." }),
  status: z.enum([RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED], {
    error: "Estado inicial inválido.",
  }),
  notes: z.string().trim().max(500).optional(),
  customerLanguage: publicLanguageSchema.default(DEFAULT_PUBLIC_LANGUAGE),
});

export const toggleAdminSchema = z.object({
  adminId: z.string().min(1),
});

export type ReservationRequestInput = z.infer<typeof reservationRequestSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateAdminInput = z.infer<typeof createAdminSchema>;
export type ManualReservationInput = z.infer<typeof manualReservationSchema>;

export function formDataToRecord(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
  );
}
