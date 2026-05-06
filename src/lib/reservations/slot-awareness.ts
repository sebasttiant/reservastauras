const RESERVATION_SLOT_AWARENESS_TONE = {
  WARNING: "warning",
  REASSURING: "reassuring",
} as const;

type ReservationSlotAwarenessTone = (typeof RESERVATION_SLOT_AWARENESS_TONE)[keyof typeof RESERVATION_SLOT_AWARENESS_TONE];

export interface ReservationSlotAwarenessCounts {
  confirmedReservations: number;
  confirmedPeople: number;
  pendingReservations: number;
  pendingPeople: number;
}

export interface ReservationSlotAwarenessNotice extends ReservationSlotAwarenessCounts {
  tone: ReservationSlotAwarenessTone;
  title: string;
  summary: string;
  advisory: string;
}

function reservationLabel(count: number): string {
  return count === 1 ? "reserva" : "reservas";
}

function requestLabel(count: number): string {
  return count === 1 ? "solicitud" : "solicitudes";
}

function peopleLabel(count: number): string {
  return count === 1 ? "persona" : "personas";
}

export function buildReservationSlotAwarenessNotice(
  counts: ReservationSlotAwarenessCounts,
): ReservationSlotAwarenessNotice {
  const hasOtherActiveRequests = counts.confirmedReservations > 0 || counts.pendingReservations > 0;

  if (!hasOtherActiveRequests) {
    return {
      ...counts,
      tone: RESERVATION_SLOT_AWARENESS_TONE.REASSURING,
      title: "Slot sin otras solicitudes activas",
      summary: "No hay otras reservas confirmadas ni solicitudes pendientes para esa misma zona, fecha y horario.",
      advisory: "No bloquea la confirmación; es una alerta operativa para revisar disponibilidad real de mesas en sitio.",
    };
  }

  const confirmedSummary = counts.confirmedReservations > 0
    ? `Ya hay ${counts.confirmedReservations} ${reservationLabel(counts.confirmedReservations)} confirmadas (${counts.confirmedPeople} ${peopleLabel(counts.confirmedPeople)}) en esta misma zona, fecha y horario.`
    : "No hay reservas confirmadas en esta misma zona, fecha y horario.";
  const pendingSummary = counts.pendingReservations > 0
    ? `También hay ${counts.pendingReservations} ${requestLabel(counts.pendingReservations)} pendiente${counts.pendingReservations === 1 ? "" : "s"} (${counts.pendingPeople} ${peopleLabel(counts.pendingPeople)}) para revisar.`
    : "No hay solicitudes pendientes adicionales para este slot.";

  return {
    ...counts,
    tone: RESERVATION_SLOT_AWARENESS_TONE.WARNING,
    title: "Revisá disponibilidad real de mesas",
    summary: `${confirmedSummary} ${pendingSummary}`,
    advisory: "No bloquea la confirmación; es una alerta para revisar disponibilidad real de mesas en sitio.",
  };
}
