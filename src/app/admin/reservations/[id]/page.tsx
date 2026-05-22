import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelReservationAction, confirmReservationAction, rejectReservationAction, resendConfirmationEmailAction } from "@/app/actions";
import { RESERVATION_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { canTransitionReservation } from "@/lib/reservations/state";
import { buildReservationSlotAwarenessNotice } from "@/lib/reservations/slot-awareness";
import { requireAdmin } from "@/lib/auth";
import { parsePublicLanguage } from "@/lib/i18n/language";
import type { PublicLanguage } from "@/lib/i18n/language";
import { RESERVATION_DETAIL_ERROR_MESSAGES, lookupMessage } from "@/lib/messages";
import { ReservationReasonPicker } from "./_components/reservation-reason-picker";

interface ReservationDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export const metadata = { title: "Detalle de reserva · Reservas Tauras" };

const SUCCESS_MESSAGES: Record<string, string> = {
  confirmed: "La reserva fue confirmada correctamente. Si el email tuvo algún problema, lo vas a ver debajo.",
  "manual-created": "La reserva fue cargada manualmente. No se envió email automático al cliente.",
  "email-resent": "El email de confirmación fue reenviado al cliente.",
  rejected: "La reserva fue rechazada correctamente.",
  cancelled: "La reserva fue cancelada correctamente.",
};

const NOT_AVAILABLE_LABEL = "No disponible";
const REJECTION_REASON_PREFIX = "RECHAZO:";
const STATUS_OUTCOME_OK_KEYS = new Set(["confirmed", "rejected", "cancelled"]);

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "long",
  timeStyle: "short",
});

function formatActionDate(date: Date | null | undefined): string {
  if (!date) return NOT_AVAILABLE_LABEL;
  return DATE_TIME_FORMATTER.format(date);
}

function extractRejectionReasonFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const firstLine = notes.split("\n", 1)[0]?.trim() ?? "";
  if (!firstLine.startsWith(REJECTION_REASON_PREFIX)) return null;
  const reason = firstLine.slice(REJECTION_REASON_PREFIX.length).trim();
  return reason.length > 0 ? reason : null;
}

interface StatusOutcomeNoticeProps {
  tone: "confirmed" | "rejected" | "cancelled";
  headline: string;
  actorLabel: string;
  actorValue: string;
  reasonValue?: string;
  dateLabel: string;
  dateValue: string;
}

function StatusOutcomeNotice({
  tone,
  headline,
  actorLabel,
  actorValue,
  reasonValue,
  dateLabel,
  dateValue,
}: StatusOutcomeNoticeProps) {
  return (
    <aside className={`notice status-outcome status-outcome-${tone}`} aria-live="polite">
      <strong>{headline}</strong>
      <dl className="status-outcome-list">
        <div>
          <dt>{actorLabel}</dt>
          <dd>{actorValue}</dd>
        </div>
        {reasonValue !== undefined ? (
          <div>
            <dt>Motivo</dt>
            <dd>{reasonValue}</dd>
          </div>
        ) : null}
        <div>
          <dt>{dateLabel}</dt>
          <dd>{dateValue}</dd>
        </div>
      </dl>
    </aside>
  );
}

const STATUS_LABELS: Record<string, string> = {
  [RESERVATION_STATUS.PENDING]: "Pendiente",
  [RESERVATION_STATUS.CONFIRMED]: "Confirmada",
  [RESERVATION_STATUS.REJECTED]: "Rechazada",
  [RESERVATION_STATUS.CANCELLED]: "Cancelada",
};

const CUSTOMER_LANGUAGE_LABELS: Record<PublicLanguage, string> = {
  es: "Español",
  en: "Inglés",
};

const RESERVATION_SOURCE_LABELS: Record<string, string> = {
  web: "Web",
  whatsapp: "WhatsApp",
  llamada: "Llamada",
  instagram: "Instagram",
  facebook: "Facebook",
  crm: "CRM",
  presencial: "Presencial",
  otro: "Otro",
};

export const dynamic = "force-dynamic";

export default async function ReservationDetailPage({ params, searchParams }: ReservationDetailPageProps) {
  await requireAdmin();
  const { id } = await params;
  const query = await searchParams;
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { user: true, confirmedBy: true, rejectedBy: true, cancelledBy: true, createdByAdmin: true, location: true },
  });

  if (!reservation) notFound();

  const sameSlotSummary = await prisma.reservation.groupBy({
    by: ["status"],
    where: {
      id: { not: reservation.id },
      reservationDate: reservation.reservationDate,
      reservationTime: reservation.reservationTime,
      locationId: reservation.locationId,
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
  // Reenvío disponible solo cuando la reserva ya está confirmada. Cubre dos
  // casos: (a) reservas manuales nacidas como "Confirmada sin email automático"
  // que necesitan mandar el mail después; (b) confirmaciones donde el envío
  // inicial falló y quedó `emailError`.
  const canResendConfirmationEmail = reservation.status === RESERVATION_STATUS.CONFIRMED;
  const hasActions = canConfirm || canReject || canCancel || canResendConfirmationEmail;
  const customerLanguage = parsePublicLanguage(reservation.customerLanguage);

  const rejectionReasonFromNotes = extractRejectionReasonFromNotes(reservation.notes);

  let statusOutcome: StatusOutcomeNoticeProps | null = null;
  if (reservation.status === RESERVATION_STATUS.CONFIRMED) {
    statusOutcome = {
      tone: "confirmed",
      headline: "La reserva fue confirmada correctamente.",
      actorLabel: "Confirmada por",
      actorValue: reservation.confirmedBy?.email ?? NOT_AVAILABLE_LABEL,
      dateLabel: "Fecha de confirmación",
      dateValue: formatActionDate(reservation.confirmedAt),
    };
  } else if (reservation.status === RESERVATION_STATUS.REJECTED) {
    statusOutcome = {
      tone: "rejected",
      headline: "La reserva fue rechazada correctamente.",
      actorLabel: "Rechazada por",
      actorValue: reservation.rejectedBy?.email ?? NOT_AVAILABLE_LABEL,
      reasonValue: reservation.rejectionReason ?? rejectionReasonFromNotes ?? NOT_AVAILABLE_LABEL,
      dateLabel: "Fecha de rechazo",
      dateValue: formatActionDate(reservation.rejectedAt),
    };
  } else if (reservation.status === RESERVATION_STATUS.CANCELLED) {
    statusOutcome = {
      tone: "cancelled",
      headline: "La reserva fue cancelada correctamente.",
      actorLabel: "Cancelada por",
      actorValue: reservation.cancelledBy?.email ?? NOT_AVAILABLE_LABEL,
      reasonValue: reservation.cancellationReason ?? NOT_AVAILABLE_LABEL,
      dateLabel: "Fecha de cancelación",
      dateValue: formatActionDate(reservation.cancelledAt),
    };
  }

  return (
    <main className="admin-shell">
      <Link className="back-link" href="/admin">← Volver al dashboard</Link>
      <section className="card grid">
        <div className="detail-hero">
          <div>
          <p className="brand-kicker">Reserva {reservation.id}</p>
          <h1>{reservation.user.name}</h1>
            <p className="muted">{reservation.reservationDate.toISOString().slice(0, 10)} · {reservation.reservationTime} · {reservation.location.shortName} · {reservation.area ?? "Sin área"}</p>
          </div>
          <span className={`status-pill status-${reservation.status.toLowerCase()}`}>{STATUS_LABELS[reservation.status]}</span>
        </div>

        {statusOutcome ? <StatusOutcomeNotice {...statusOutcome} /> : null}
        {successMessage && !STATUS_OUTCOME_OK_KEYS.has(query.ok ?? "") ? <p className="notice">{successMessage}</p> : null}
        {errorMessage ? <p className="notice error">{errorMessage}</p> : null}
        {reservation.emailError ? <p className="notice error">Confirmada, pero falló el email: {reservation.emailError}</p> : null}

        <aside className={`notice ${slotAwarenessNotice.tone === "warning" ? "warning" : "muted-notice"}`} aria-label="Alerta operativa de disponibilidad">
          <strong>{slotAwarenessNotice.title}</strong>
          <p>{slotAwarenessNotice.summary}</p>
          <p>{slotAwarenessNotice.advisory}</p>
        </aside>

        <dl className="grid two">
          <div><dt>Estado</dt><dd>{STATUS_LABELS[reservation.status]}</dd></div>
          <div><dt>Sede</dt><dd>{reservation.location.reservationLabel}</dd></div>
          <div><dt>Dirección sede</dt><dd>{reservation.location.address ?? "-"}</dd></div>
          <div><dt>Personas</dt><dd>{reservation.partySize}</dd></div>
          <div><dt>Origen</dt><dd>{RESERVATION_SOURCE_LABELS[reservation.source] ?? reservation.source}</dd></div>
          <div><dt>Idioma del cliente</dt><dd>{CUSTOMER_LANGUAGE_LABELS[customerLanguage]}</dd></div>
          <div><dt>Email</dt><dd>{reservation.user.email}</dd></div>
          <div><dt>Teléfono</dt><dd>{reservation.user.phone ?? "-"}</dd></div>
          <div><dt>Cargada por</dt><dd>{reservation.createdByAdmin?.email ?? "-"}</dd></div>
          <div><dt>Confirmada por</dt><dd>{reservation.confirmedBy?.email ?? "-"}</dd></div>
          {reservation.status === RESERVATION_STATUS.REJECTED ? (
            <div><dt>Rechazada por</dt><dd>{reservation.rejectedBy?.email ?? "-"}</dd></div>
          ) : null}
          {reservation.status === RESERVATION_STATUS.CANCELLED ? (
            <div><dt>Cancelada por</dt><dd>{reservation.cancelledBy?.email ?? "-"}</dd></div>
          ) : null}
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
            {canResendConfirmationEmail ? (
              <form action={resendConfirmationEmailAction}>
                <input type="hidden" name="reservationId" value={reservation.id} />
                <button className="secondary" type="submit">
                  {reservation.emailError ? "Reintentar email de confirmación" : "Reenviar email de confirmación"}
                </button>
              </form>
            ) : null}
            {canReject ? (
              <form action={rejectReservationAction} className="action-form">
                <input type="hidden" name="reservationId" value={reservation.id} />
                <ReservationReasonPicker variant="reject" />
                <button className="danger" type="submit">Rechazar reserva</button>
              </form>
            ) : null}
            {canCancel ? (
              <form action={cancelReservationAction} className="action-form">
                <input type="hidden" name="reservationId" value={reservation.id} />
                <ReservationReasonPicker variant="cancel" />
                <button className="secondary" type="submit">Cancelar reserva</button>
              </form>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
