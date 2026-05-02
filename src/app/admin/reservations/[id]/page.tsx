import Link from "next/link";
import { notFound } from "next/navigation";
import { confirmReservationAction, rejectReservationAction } from "@/app/actions";
import { RESERVATION_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

interface ReservationDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export const dynamic = "force-dynamic";

export default async function ReservationDetailPage({ params, searchParams }: ReservationDetailPageProps) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { user: true, confirmedBy: true },
  });

  if (!reservation) notFound();

  const isPending = reservation.status === RESERVATION_STATUS.PENDING;

  return (
    <main className="grid">
      <Link href="/admin">← Volver</Link>
      <section className="card grid">
        <div>
          <p className="muted">Reserva {reservation.id}</p>
          <h1>{reservation.user.name}</h1>
          <p>{reservation.reservationDate.toISOString().slice(0, 10)} · {reservation.reservationTime} · {reservation.area ?? "Sin área"}</p>
        </div>

        {query.error ? <p className="notice error">{query.error}</p> : null}
        {reservation.emailError ? <p className="notice error">Confirmada, pero falló el email: {reservation.emailError}</p> : null}

        <dl className="grid two">
          <div><dt>Estado</dt><dd>{reservation.status}</dd></div>
          <div><dt>Personas</dt><dd>{reservation.partySize}</dd></div>
          <div><dt>Email</dt><dd>{reservation.user.email}</dd></div>
          <div><dt>Teléfono</dt><dd>{reservation.user.phone ?? "-"}</dd></div>
          <div><dt>Confirmada por</dt><dd>{reservation.confirmedBy?.email ?? "-"}</dd></div>
          <div><dt>Notas</dt><dd>{reservation.notes ?? "-"}</dd></div>
        </dl>

        {isPending ? (
          <div className="actions">
            <form action={confirmReservationAction}>
              <input type="hidden" name="reservationId" value={reservation.id} />
              <button type="submit">Confirmar y enviar email</button>
            </form>
            <form action={rejectReservationAction}>
              <input type="hidden" name="reservationId" value={reservation.id} />
              <button className="danger" type="submit">Rechazar</button>
            </form>
          </div>
        ) : null}
      </section>
    </main>
  );
}
