import Link from "next/link";
import { Prisma, type ReservationStatus } from "@prisma/client";
import { logoutAction } from "@/app/actions";
import { ADMIN_ROLE, RESERVATION_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

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
        { area: { contains: query, mode: "insensitive" } },
      ],
    } : {}),
  };

  const reservations = await prisma.reservation.findMany({
    where,
    orderBy: [{ reservationDate: "desc" }, { reservationTime: "desc" }, { createdAt: "desc" }],
    include: { user: true },
    take: 250,
  });

  const summary = await prisma.reservation.groupBy({ by: ["status"], _count: { status: true } });
  const counts = new Map(summary.map((item) => [item.status, item._count.status]));

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="admin-title">
          <p className="brand-kicker">Tauras Admin</p>
          <h1>Reservas</h1>
          <p className="muted">Gestioná solicitudes con confirmación humana, trazabilidad y control anti-solapamiento.</p>
        </div>
        <div className="actions">
          {admin.role === ADMIN_ROLE.SUPER_ADMIN ? (
            <>
              <Link className="button" href="/api/export?format=xlsx">Exportar Excel</Link>
              <Link className="button" href="/api/export?format=pdf">Exportar PDF</Link>
              <Link className="button secondary" href="/admin/users">Usuarios</Link>
              <Link className="button secondary" href="/admin/settings/email">Correo</Link>
            </>
          ) : null}
          <form action={logoutAction}><button className="secondary" type="submit">Salir</button></form>
        </div>
      </header>

      {params.error ? <p className="notice error">{params.error}</p> : null}

      <nav className="actions card filters">
        <Link href="/admin">Todas</Link>
        {Object.values(RESERVATION_STATUS).map((item) => <Link key={item} href={`/admin?status=${item}`}>{STATUS_LABELS[item]}</Link>)}
      </nav>

      <form className="card grid two" action="/admin">
        <label>Buscar cliente, email, teléfono o zona
          <input name="q" defaultValue={query ?? ""} placeholder="Ej: Laura, admin@email.com, Terraza" />
        </label>
        <label>Fecha exacta
          <input name="date" type="date" defaultValue={date ?? ""} />
        </label>
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <button type="submit">Filtrar histórico</button>
        <Link className="button secondary" href="/admin">Limpiar filtros</Link>
      </form>

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
          <thead><tr><th>Fecha</th><th>Hora</th><th>Cliente</th><th>Teléfono</th><th>Área</th><th>Estado</th><th>Creada</th><th /></tr></thead>
          <tbody>
            {reservations.length === 0 ? (
              <tr><td colSpan={8} className="muted">No hay reservas para este filtro.</td></tr>
            ) : (
              reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td>{reservation.reservationDate.toISOString().slice(0, 10)}</td>
                  <td>{reservation.reservationTime}</td>
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
