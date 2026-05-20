import Link from "next/link";
import type { Route } from "next";
import { Prisma, type ReservationStatus } from "@prisma/client";
import { logoutAction } from "@/app/actions";
import { ADMIN_ROLE, RESERVATION_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ADMIN_ERROR_MESSAGES, lookupMessage } from "@/lib/messages";
import { getBusinessTodayDateString } from "@/lib/reservations/business-date";
import { AdminReservationFilters } from "./_components/admin-reservation-filters";

// Construye la URL del export forwardeando los filtros activos del dashboard.
// `q` y `date` espejan los nombres del dashboard; `from`/`to` no se usan acá
// — esos los elige el admin desde la sección "Exportar reportes".
function buildExportHref(input: {
  format: "xlsx" | "pdf";
  status: string | undefined;
  q: string | undefined;
  date: string | undefined;
}): Route {
  const sp = new URLSearchParams({ format: input.format });
  if (input.status) sp.set("status", input.status);
  if (input.q) sp.set("q", input.q);
  if (input.date) sp.set("date", input.date);
  return `/api/export?${sp.toString()}` as Route;
}

interface AdminPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export const metadata = { title: "Dashboard · Reservas Tauras" };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<ReservationStatus, string> = {
  [RESERVATION_STATUS.PENDING]: "Pendiente",
  [RESERVATION_STATUS.CONFIRMED]: "Confirmada",
  [RESERVATION_STATUS.REJECTED]: "Rechazada",
  [RESERVATION_STATUS.CANCELLED]: "Cancelada",
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const statusValues = Object.values(RESERVATION_STATUS) as string[];
  const status = params.status && statusValues.includes(params.status) ? (params.status as ReservationStatus) : undefined;
  const query = params.q?.trim();
  const date = params.date?.trim();
  const where: Prisma.ReservationWhereInput = {
    ...(status ? { status } : {}),
    ...(date ? { reservationDate: new Date(`${date}T00:00:00.000Z`) } : {}),
    ...(query ? {
      OR: [
        { user: { name: { contains: query, mode: "insensitive" } } },
        { user: { email: { contains: query, mode: "insensitive" } } },
        { user: { phone: { contains: query, mode: "insensitive" } } },
        { location: { name: { contains: query, mode: "insensitive" } } },
        { location: { shortName: { contains: query, mode: "insensitive" } } },
        { location: { reservationLabel: { contains: query, mode: "insensitive" } } },
        { area: { contains: query, mode: "insensitive" } },
      ],
    } : {}),
  };

  const reservations = await prisma.reservation.findMany({
    where,
    orderBy: [{ reservationDate: "desc" }, { reservationTime: "desc" }, { createdAt: "desc" }],
    include: { user: true, location: true },
    take: 250,
  });

  const summary = await prisma.reservation.groupBy({ by: ["status"], _count: { status: true } });
  const counts = new Map(summary.map((item) => [item.status, item._count.status]));
  const errorMessage = lookupMessage(ADMIN_ERROR_MESSAGES, params.error);

  const hasActiveFilters = Boolean(status || query || date);
  const exportXlsxHref = buildExportHref({ format: "xlsx", status, q: query, date });
  const exportPdfHref = buildExportHref({ format: "pdf", status, q: query, date });
  const today = getBusinessTodayDateString();
  const activeFilterItems = [
    status ? `Estado: ${STATUS_LABELS[status]}` : null,
    date ? `Fecha: ${date}` : null,
    query ? `Búsqueda: ${query}` : null,
  ].filter((item): item is string => item !== null);

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="admin-title">
          <p className="brand-kicker">Tauras Admin</p>
          <h1>Reservas</h1>
          <p className="muted">Gestioná reservas con criterio humano y trazabilidad.</p>
        </div>
        <div className="actions">
          <Link className="button" href="/admin/reservations/new">Nueva reserva</Link>
          {admin.role === ADMIN_ROLE.SUPER_ADMIN ? (
            <>
              {hasActiveFilters ? (
                <>
                  <Link className="button" href={exportXlsxHref}>Exportar Excel filtrado</Link>
                  <Link className="button" href={exportPdfHref}>Exportar PDF filtrado</Link>
                </>
              ) : null}
              <Link className="button secondary" href="/admin/users">Usuarios</Link>
              <Link className="button secondary" href={"/admin/settings/photos" as unknown as Route}>Fotos</Link>
              <Link className="button secondary" href="/admin/settings/email">Correo</Link>
            </>
          ) : null}
          <form action={logoutAction}><button className="secondary" type="submit">Salir</button></form>
        </div>
      </header>

      {errorMessage ? <p className="notice error">{errorMessage}</p> : null}

      <nav className="actions card filters">
        <Link href="/admin">Todas</Link>
        {Object.values(RESERVATION_STATUS).map((item) => <Link key={item} href={`/admin?status=${item}`}>{STATUS_LABELS[item]}</Link>)}
      </nav>

      <AdminReservationFilters key={`${status ?? ""}-${query ?? ""}-${date ?? ""}`} query={query ?? ""} date={date ?? ""} status={status} maxDate={today} />

      {activeFilterItems.length > 0 ? (
        <aside className="notice muted-notice active-filters" aria-label="Filtros activos" role="status">
          <strong>Filtros activos</strong>
          <div className="filter-chip-list">
            {activeFilterItems.map((item) => <span className="filter-chip" key={item}>{item}</span>)}
          </div>
          <Link className="inline-link" href="/admin">Limpiar filtros</Link>
        </aside>
      ) : null}

      {admin.role === ADMIN_ROLE.SUPER_ADMIN ? (
        <section className="card grid" aria-label="Exportar reportes">
          <div className="section-heading">
            <h2>Exportar por rango de fechas</h2>
            <p className="muted">
              Seleccioná un rango de fechas para evitar reportes demasiado grandes. Los botones superiores exportan solo la vista filtrada actual.
            </p>
          </div>
          <form action="/api/export" method="get" className="grid">
            <div className="grid two">
              <label>Desde
                <input name="from" type="date" max={today} required />
              </label>
              <label>Hasta
                <input name="to" type="date" max={today} required />
              </label>
            </div>
            <div className="actions">
              <button type="submit" name="format" value="xlsx">Exportar Excel por rango</button>
              <button type="submit" name="format" value="pdf" className="secondary">Exportar PDF por rango</button>
            </div>
          </form>
          <p className="notice muted-notice" role="note">
            {hasActiveFilters
              ? "Los botones superiores exportan con los filtros activos del dashboard. Esta sección genera un reporte por rango de fechas independiente."
              : "Para exportar, aplicá un filtro en la vista o generá un reporte por rango de fechas."}
          </p>
        </section>
      ) : null}

      <section className="dashboard-summary" aria-label="Resumen de reservas">
        <article className="summary-card">
          <span>Mostrando</span>
          <strong>{reservations.length}</strong>
          <small>{status ? STATUS_LABELS[status] : "Histórico filtrado"}</small>
        </article>
        {Object.values(RESERVATION_STATUS).map((item) => (
          <article className="summary-card" key={item}>
            <span>{STATUS_LABELS[item]}</span>
            <strong>{counts.get(item) ?? 0}</strong>
            <small>Total histórico</small>
          </article>
        ))}
      </section>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Hora</th><th>Sede</th><th>Cliente</th><th>Teléfono</th><th>Área</th><th>Estado</th><th>Creada</th><th /></tr></thead>
          <tbody>
            {reservations.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className="empty-state">
                    <strong>No encontramos reservas para esta vista.</strong>
                    <span>{hasActiveFilters ? "Probá limpiar los filtros o ajustar la búsqueda." : "Cuando entren reservas, aparecerán acá."}</span>
                    {hasActiveFilters ? <Link className="button secondary table-button" href="/admin">Limpiar filtros</Link> : null}
                  </div>
                </td>
              </tr>
            ) : (
              reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td>{reservation.reservationDate.toISOString().slice(0, 10)}</td>
                  <td>{reservation.reservationTime}</td>
                  <td>{reservation.location.shortName}</td>
                  <td>{reservation.user.name}<br /><span className="muted">{reservation.user.email}</span></td>
                  <td>{reservation.user.phone ?? "-"}</td>
                  <td>{reservation.area ?? "Sin área"}</td>
                  <td><span className={`status-pill status-${reservation.status.toLowerCase()}`}>{STATUS_LABELS[reservation.status]}</span></td>
                  <td>{reservation.createdAt.toISOString().slice(0, 10)}</td>
                  <td><Link className="button table-button" href={`/admin/reservations/${reservation.id}`}>Ver detalle</Link></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
