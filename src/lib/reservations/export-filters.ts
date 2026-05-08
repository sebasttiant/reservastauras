import { z } from "zod";
import { RESERVATION_STATUS, type ReservationStatusValue } from "@/lib/constants";

// Tope duro contra exports gigantes (PDFs de cientos de páginas, XLSX que
// timeoutean al renderizar). El default ya da varios años de operación de un
// restaurante; si se quiere más, hay que pasar `limit` explícito hasta el
// MAX_LIMIT, o mejor: filtrar por rango de fechas/estado.
export const EXPORT_DEFAULT_LIMIT = 5000;
export const EXPORT_MAX_LIMIT = 10000;

export const EXPORT_FORMATS = ["json", "xlsx", "pdf"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

const dateOnlySchema = z
  .string()
  .regex(dateOnlyRegex, "Debe tener formato YYYY-MM-DD")
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .refine((d) => !Number.isNaN(d.getTime()), { message: "Fecha inválida" });

const statusSchema = z.enum([
  RESERVATION_STATUS.PENDING,
  RESERVATION_STATUS.CONFIRMED,
  RESERVATION_STATUS.REJECTED,
  RESERVATION_STATUS.CANCELLED,
]);

export const exportFiltersSchema = z
  .object({
    format: z.enum(EXPORT_FORMATS).default("xlsx"),
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
    status: statusSchema.optional(),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(EXPORT_MAX_LIMIT)
      .optional(),
  })
  .refine(
    (filters) => !(filters.from && filters.to) || filters.from <= filters.to,
    { message: "El rango de fechas es inválido: 'from' debe ser anterior o igual a 'to'.", path: ["from"] },
  );

export type ExportFilters = z.infer<typeof exportFiltersSchema>;

export interface ExportFilterParseResult {
  ok: boolean;
  data?: ExportFilters;
  error?: string;
}

export function parseExportFilters(searchParams: URLSearchParams): ExportFilterParseResult {
  const raw: Record<string, string> = {};
  for (const key of ["format", "from", "to", "status", "limit"] as const) {
    const v = searchParams.get(key);
    if (v !== null && v !== "") raw[key] = v;
  }

  const result = exportFiltersSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, error: first ? first.message : "Filtros inválidos" };
  }
  return { ok: true, data: result.data };
}

export interface ReservationWhereClause {
  reservationDate?: { gte?: Date; lte?: Date };
  status?: ReservationStatusValue;
}

export function buildReservationWhere(filters: ExportFilters): ReservationWhereClause {
  const where: ReservationWhereClause = {};

  if (filters.from || filters.to) {
    where.reservationDate = {};
    if (filters.from) where.reservationDate.gte = filters.from;
    if (filters.to) {
      // `to` es un día, no un instante. Para incluir todo el día seleccionado
      // hacemos lte = end-of-day. Sin esto, una reserva del mismo `to` en
      // hora 14:00 quedaría excluida si el campo persistido es un Date con hora.
      const endOfDay = new Date(filters.to);
      endOfDay.setUTCHours(23, 59, 59, 999);
      where.reservationDate.lte = endOfDay;
    }
  }

  if (filters.status) {
    where.status = filters.status;
  }

  return where;
}
