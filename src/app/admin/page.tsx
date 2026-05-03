import Link from "next/link";
import type { ReservationStatus } from "@prisma/client";
import { logoutAction } from "@/app/actions";
import { RESERVATION_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

interface AdminPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export const metadata = { title: "Dashboard · Reservas Tauras" };
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: AdminPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const statusValues = Object.values(RESERVATION_STATUS) as string[];
  const status = params.status && statusValues.includes(params.status) ? (params.status as ReservationStatus) : undefined;

  const reservations = await prisma.reservation.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ reservationDate: "asc" }, { reservationTime: "asc" }],
    include: { user: true },
    take: 100,
  });

  return (
    <main className="grid">
      <header className="actions">
        <div style={{ flex: 1 }}>
          <h1>Reservas</h1>
          <p className="muted">Confirmación humana y control anti-solapamiento.</p>
        </div>
        <form action={logoutAction}><button className="secondary" type="submit">Salir</button></form>
      </header>

      {params.error ? <p className="notice error">{params.error}</p> : null}

      <nav className="actions card">
        <Link href="/admin">Todas</Link>
        {Object.values(RESERVATION_STATUS).map((item) => <Link key={item} href={`/admin?status=${item}`}>{item}</Link>)}
      </nav>

      <table>
        <thead><tr><th>Fecha</th><th>Hora</th><th>Cliente</th><th>Área</th><th>Estado</th><th /></tr></thead>
        <tbody>
          {reservations.length === 0 ? (
            <tr><td colSpan={6} className="muted">No hay reservas para este filtro.</td></tr>
          ) : (
            reservations.map((reservation) => (
              <tr key={reservation.id}>
                <td>{reservation.reservationDate.toISOString().slice(0, 10)}</td>
                <td>{reservation.reservationTime}</td>
                <td>{reservation.user.name}<br /><span className="muted">{reservation.user.email}</span></td>
                <td>{reservation.area ?? "Sin área"}</td>
                <td>{reservation.status}</td>
                <td><Link href={`/admin/reservations/${reservation.id}`}>Ver</Link></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </main>
  );
}
