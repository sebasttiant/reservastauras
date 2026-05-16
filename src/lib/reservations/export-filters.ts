import { z } from "zod";
import { RESERVATION_STATUS, type ReservationStatusValue } from "@/lib/constants";

// Tope duro contra exports gigantes (PDFs de cientos de páginas, XLSX que
// timeoutean al renderizar). El default ya da varios años de operación de un
// restaurante; si se quiere más, hay que pasar `limit` explícito hasta el
// MAX_LIMIT, o mejor: filtrar por rango de fechas/estado.
export const EXPORT_DEFAULT_LIMIT = 5000;
export const EXPORT_MAX_LIMIT = 10000;

// Tope para `q`. Lo suficientemente generoso para emails/teléfonos/nombres
// largos, sin habilitar payloads abusivos. La búsqueda hace `contains` literal
// en cuatro columnas, así que strings muy largos solo pegan I/O sin rédito.
export const EXPORT_QUERY_MAX_LENGTH = 100;

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

const querySchema = z
  .string()
  .trim()
  .min(1, { message: "La búsqueda no puede estar vacía." })
  .max(EXPORT_QUERY_MAX_LENGTH, {
    message: `La búsqueda supera ${EXPORT_QUERY_MAX_LENGTH} caracteres.`,
  });

export const exportFiltersSchema = z
  .object({
    format: z.enum(EXPORT_FORMATS).default("xlsx"),
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
    // `date` es match exacto de un día (espejo del filtro del dashboard).
    // Es mutuamente excluyente con `from`/`to`: si vienen ambos, devolvemos
    // 400 para evitar reportes ambiguos.
    date: dateOnlySchema.optional(),
    status: statusSchema.optional(),
    q: querySchema.optional(),
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
  )
  .refine(
    (filters) => !filters.date || (!filters.from && !filters.to),
    {
      message: "Usá 'date' (fecha exacta) o 'from'/'to' (rango), no ambos.",
      path: ["date"],
    },
  );

export type ExportFilters = z.infer<typeof exportFiltersSchema>;

export interface ExportFilterParseResult {
  ok: boolean;
  data?: ExportFilters;
  error?: string;
}

export function parseExportFilters(searchParams: URLSearchParams): ExportFilterParseResult {
  const raw: Record<string, string> = {};
  for (const key of ["format", "from", "to", "date", "status", "q", "limit"] as const) {
    const v = searchParams.get(key);
    if (v === null) continue;
    // Tratamos vacío y solo-whitespace como "ausente" en lugar de error 400.
    // Un input de UI vacío manda `?q=` o `?date=`; eso es benigno y no debe
    // bloquear el export.
    const trimmed = v.trim();
    if (trimmed === "") continue;
    raw[key] = trimmed;
  }

  const result = exportFiltersSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, error: first ? first.message : "Filtros inválidos" };
  }
  return { ok: true, data: result.data };
}

type DateRange = { gte?: Date; lte?: Date };

type StringFilter = { contains: string; mode: "insensitive" };

interface ReservationOrCondition {
  user?: { name?: StringFilter; email?: StringFilter; phone?: StringFilter };
  location?: { name?: StringFilter; shortName?: StringFilter; reservationLabel?: StringFilter };
  area?: StringFilter;
}

export interface ReservationWhereClause {
  reservationDate?: DateRange;
  status?: ReservationStatusValue;
  OR?: ReservationOrCondition[];
}

function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

export function buildReservationWhere(filters: ExportFilters): ReservationWhereClause {
  const where: ReservationWhereClause = {};

  // `date` (match exacto) se normaliza a un rango cerrado del mismo día para
  // que el resto del pipeline trate fechas siempre con la misma forma. La
  // columna `reservationDate` es `@db.Date`, así que comparar contra timestamps
  // del mismo día funciona correctamente en Postgres.
  if (filters.date) {
    where.reservationDate = { gte: filters.date, lte: endOfDay(filters.date) };
  } else if (filters.from || filters.to) {
    where.reservationDate = {};
    if (filters.from) where.reservationDate.gte = filters.from;
    if (filters.to) {
      // `to` es un día, no un instante. Para incluir todo el día seleccionado
      // hacemos lte = end-of-day. Sin esto, una reserva del mismo `to` en
      // hora 14:00 quedaría excluida si el campo persistido es un Date con hora.
      where.reservationDate.lte = endOfDay(filters.to);
    }
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.q) {
    // Búsqueda case-insensitive sobre cuatro columnas, espejo del filtro del
    // dashboard. NO usamos full-text ni regex: contains literal alcanza para
    // los volúmenes de un restaurante y evita superficies de inyección.
    where.OR = [
      { user: { name: { contains: filters.q, mode: "insensitive" } } },
      { user: { email: { contains: filters.q, mode: "insensitive" } } },
      { user: { phone: { contains: filters.q, mode: "insensitive" } } },
      { location: { name: { contains: filters.q, mode: "insensitive" } } },
      { location: { shortName: { contains: filters.q, mode: "insensitive" } } },
      { location: { reservationLabel: { contains: filters.q, mode: "insensitive" } } },
      { area: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  return where;
}

// Resumen plano de filtros para mostrar en el header del PDF y en la hoja
// "Resumen" del Excel. Devuelve filas como {label, value} para que el caller
// elija el rendering. Mantenerlo acá centraliza la traducción a etiquetas
// humanas y evita drift entre formatos.
export interface FilterSummaryRow {
  label: string;
  value: string;
}

const STATUS_LABELS: Record<ReservationStatusValue, string> = {
  PENDING: "Pendientes",
  CONFIRMED: "Confirmadas",
  REJECTED: "Rechazadas",
  CANCELLED: "Canceladas",
};

function isoDate(d: Date | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}

export function summarizeFilters(filters: ExportFilters): FilterSummaryRow[] {
  const rows: FilterSummaryRow[] = [];
  if (filters.date) {
    rows.push({ label: "Fecha exacta", value: isoDate(filters.date) });
  } else {
    rows.push({ label: "Desde", value: isoDate(filters.from) });
    rows.push({ label: "Hasta", value: isoDate(filters.to) });
  }
  rows.push({
    label: "Estado",
    value: filters.status ? STATUS_LABELS[filters.status] : "Todos",
  });
  rows.push({ label: "Búsqueda", value: filters.q ?? "—" });
  return rows;
}

// True cuando el export sale "abierto": sin rango ni fecha exacta ni estado ni
// búsqueda. Lo usa la UI para advertir al usuario antes de disparar reportes
// gigantes, y la API podría usarlo a futuro para auditoría. NO lo usamos para
// bloquear: el límite duro sigue siendo `effectiveLimit` (413).
export function isOpenExport(filters: ExportFilters): boolean {
  return !filters.from && !filters.to && !filters.date && !filters.status && !filters.q;
}
