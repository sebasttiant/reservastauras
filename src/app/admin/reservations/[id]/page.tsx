import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelReservationAction, confirmReservationAction, rejectReservationAction } from "@/app/actions";
import { RESERVATION_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { canTransitionReservation } from "@/lib/reservations/state";
import { buildReservationSlotAwarenessNotice } from "@/lib/reservations/slot-awareness";
import { requireAdmin } from "@/lib/auth";
import { RESERVATION_DETAIL_ERROR_MESSAGES, lookupMessage } from "@/lib/messages";

interface ReservationDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const SUCCESS_MESSAGES: Record<string, string> = {
  confirmed: "Reserva confirmada. Si el email tuvo algún problema, lo vas a ver debajo.",
  rejected: "Reserva rechazada correctamente.",
  cancelled: "Reserva cancelada correctamente.",
};

const STATUS_LABELS: Record<string, string> = {
  [RESERVATION_STATUS.PENDING]: "Pendiente",
  [RESERVATION_STATUS.CONFIRMED]: "Confirmada",
  [RESERVATION_STATUS.REJECTED]: "Rechazada",
  [RESERVATION_STATUS.CANCELLED]: "Cancelada",
};

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

  const sameSlotSummary = await prisma.reservation.groupBy({
    by: ["status"],
    where: {
      id: { not: reservation.id },
      reservationDate: reservation.reservationDate,
      reservationTime: reservation.reservationTime,
      area: reservation.area,
      status: { in: [RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.PENDING] },
    },
    _count: { id: true },
    _sum: { partySize: true },
  });
  const sameSlotCounts = new Map(sameSlotSummary.map((item) => [item.status, item]));
  const slotAwarenessNotice = buildReservationSlotAwarenessNotice({
    confirmedReservations: sameSlotCounts.get(RESERVATION_STATUS.CONFIRMED)?._count.id ?? 0,
    confirmedPeople: sameSlotCounts.get(RESERVATION_STATUS.CONFIRMED)?._sum.partySize ?? 0,
    pendingReservations: sameSlotCounts.get(RESERVATION_STATUS.PENDING)?._count.id ?? 0,
    pendingPeople: sameSlotCounts.get(RESERVATION_STATUS.PENDING)?._sum.partySize ?? 0,
  });

  const successMessage = query.ok ? SUCCESS_MESSAGES[query.ok] : undefined;
  const errorMessage = lookupMessage(RESERVATION_DETAIL_ERROR_MESSAGES, query.error);
  const canConfirm = canTransitionReservation(reservation.status, RESERVATION_STATUS.CONFIRMED)
    && reservation.status !== RESERVATION_STATUS.CONFIRMED;
  const canReject = canTransitionReservation(reservation.status, RESERVATION_STATUS.REJECTED)
    && reservation.status !== RESERVATION_STATUS.REJECTED;
  const canCancel = canTransitionReservation(reservation.status, RESERVATION_STATUS.CANCELLED)
    && reservation.status !== RESERVATION_STATUS.CANCELLED;
  const hasActions = canConfirm || canReject || canCancel;

  return (
    <main className="admin-shell">
      <Link className="back-link" href="/admin">← Volver al dashboard</Link>
      <section className="card grid">
        <div className="detail-hero">
          <div>
          <p className="brand-kicker">Reserva {reservation.id}</p>
          <h1>{reservation.user.name}</h1>
            <p className="muted">{reservation.reservationDate.toISOString().slice(0, 10)} · {reservation.reservationTime} · {reservation.area ?? "Sin área"}</p>
          </div>
          <span className={`status-pill status-${reservation.status.toLowerCase()}`}>{STATUS_LABELS[reservation.status]}</span>
        </div>

        {successMessage ? <p className="notice">{successMessage}</p> : null}
        {errorMessage ? <p className="notice error">{errorMessage}</p> : null}
        {reservation.emailError ? <p className="notice error">Confirmada, pero falló el email: {reservation.emailError}</p> : null}

        <aside className={`notice ${slotAwarenessNotice.tone === "warning" ? "warning" : "muted-notice"}`} aria-label="Alerta operativa de disponibilidad">
          <strong>{slotAwarenessNotice.title}</strong>
          <p>{slotAwarenessNotice.summary}</p>
          <p>{slotAwarenessNotice.advisory}</p>
        </aside>

        <dl className="grid two">
          <div><dt>Estado</dt><dd>{STATUS_LABELS[reservation.status]}</dd></div>
          <div><dt>Personas</dt><dd>{reservation.partySize}</dd></div>
          <div><dt>Email</dt><dd>{reservation.user.email}</dd></div>
          <div><dt>Teléfono</dt><dd>{reservation.user.phone ?? "-"}</dd></div>
          <div><dt>Confirmada por</dt><dd>{reservation.confirmedBy?.email ?? "-"}</dd></div>
          <div><dt>Notas</dt><dd>{reservation.notes ?? "-"}</dd></div>
        </dl>

        {hasActions ? (
          <div className="actions">
            {canConfirm ? (
              <form action={confirmReservationAction}>
                <input type="hidden" name="reservationId" value={reservation.id} />
                <button type="submit">Confirmar y enviar email</button>
              </form>
            ) : null}
            {canReject ? (
              <form action={rejectReservationAction}>
                <input type="hidden" name="reservationId" value={reservation.id} />
                <label>Motivo del rechazo (opcional)
                  <input name="reason" placeholder="Ej: Agenda completa, cliente frecuente cancela siempre..." />
                </label>
                <button className="danger" type="submit">Rechazar</button>
              </form>
            ) : null}
            {canCancel ? (
              <form action={cancelReservationAction}>
                <input type="hidden" name="reservationId" value={reservation.id} />
                <button className="secondary" type="submit">Cancelar reserva</button>
              </form>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
