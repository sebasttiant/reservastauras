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
    take: 100,
  });
  const users = await prisma.user.findMany({
    where: { id: { in: reservations.map((reservation) => reservation.userId) } },
  });
  const usersById = new Map(users.map((user) => [user.id, user]));

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
          {reservations.map((reservation) => (
            <tr key={reservation.id}>
              <td>{reservation.reservationDate.toISOString().slice(0, 10)}</td>
              <td>{reservation.reservationTime}</td>
              <td>{usersById.get(reservation.userId)?.name ?? "Cliente"}<br /><span className="muted">{usersById.get(reservation.userId)?.email ?? "-"}</span></td>
              <td>{reservation.area ?? "Sin área"}</td>
              <td>{reservation.status}</td>
              <td><Link href={`/admin/reservations/${reservation.id}`}>Ver</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
