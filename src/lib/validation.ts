import { z } from "zod";

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Usá una fecha válida." });

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Usá un horario HH:mm válido." });

export const reservationRequestSchema = z.object({
  name: z.string().trim().min(2, { error: "Ingresá tu nombre." }).max(120),
  email: z.email({ error: "Ingresá un email válido." }).transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(40).optional(),
  reservationDate: dateOnlySchema,
  reservationTime: timeSchema,
  area: z.string().trim().max(80).optional(),
  partySize: z.coerce.number().int().min(1).max(30),
  notes: z.string().trim().max(500).optional(),
});

export const loginSchema = z.object({
  email: z.email({ error: "Email inválido." }).transform((value) => value.toLowerCase()),
  password: z.string().min(8, { error: "La contraseña debe tener al menos 8 caracteres." }),
});

export type ReservationRequestInput = z.infer<typeof reservationRequestSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export function formDataToRecord(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(formData.entries()).map(([key, value]) => [key, String(value)]),
  );
}
