import {
  formatBusinessDateForFilename,
  formatReservationActionDateTime,
  formatReservationDate,
} from "@/lib/reservations/business-date";

interface ExportCustomer {
  name: string;
  email: string;
  phone: string | null;
}

interface ExportActor {
  name: string;
  email: string;
}

interface ExportLocation {
  reservationLabel: string;
}

export interface ReservationExportRecord {
  id: string;
  reservationDate: Date;
  reservationTime: string;
  area: string | null;
  partySize: number;
  status: string;
  source: string;
  notes: string | null;
  emailError: string | null;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt: Date | null;
  rejectedAt: Date | null;
  cancelledAt: Date | null;
  landingVenue: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  user: ExportCustomer;
  location: ExportLocation;
  confirmedBy: ExportActor | null;
  createdByAdmin: ExportActor | null;
}

function formatDateTime(value: Date | null): string {
  return value ? formatReservationActionDateTime(value) : "-";
}

function formatReservationSource(source: string): string {
  const labels: Record<string, string> = {
    web: "Web",
    whatsapp: "WhatsApp",
    llamada: "Llamada",
    instagram: "Instagram",
    facebook: "Facebook",
    crm: "CRM",
    presencial: "Presencial",
    otro: "Otro",
  };

  return labels[source] ?? source;
}

export function buildReservationExportRows(reservations: ReservationExportRecord[]) {
  return reservations.map((reservation) => ({
    ID: reservation.id,
    Fecha: formatReservationDate(reservation.reservationDate),
    Hora: reservation.reservationTime,
    Cliente: reservation.user.name,
    Email: reservation.user.email,
    Teléfono: reservation.user.phone ?? "",
    Sede: reservation.location.reservationLabel,
    Área: reservation.area ?? "Sin área",
    Origen: formatReservationSource(reservation.source),
    Personas: reservation.partySize,
    Estado: reservation.status,
    "Creada en": formatDateTime(reservation.createdAt),
    "Cargada por": reservation.createdByAdmin
      ? `${reservation.createdByAdmin.name} <${reservation.createdByAdmin.email}>`
      : "Web / cliente",
    "Actualizada en": formatDateTime(reservation.updatedAt),
    "Confirmada en": formatDateTime(reservation.confirmedAt),
    "Rechazada en": formatDateTime(reservation.rejectedAt),
    "Cancelada en": formatDateTime(reservation.cancelledAt),
    "Confirmado por": reservation.confirmedBy
      ? `${reservation.confirmedBy.name} <${reservation.confirmedBy.email}>`
      : "",
    "Error email": reservation.emailError ?? "",
    Notas: reservation.notes ?? "",
    "Landing Venue": reservation.landingVenue ?? "",
    "UTM Source": reservation.utmSource ?? "",
    "UTM Medium": reservation.utmMedium ?? "",
    "UTM Campaign": reservation.utmCampaign ?? "",
    "UTM Content": reservation.utmContent ?? "",
    "UTM Term": reservation.utmTerm ?? "",
  }));
}

export function getReservationExportPdfFilename(issuedAt: Date): string {
  return `reservas-tauras-${formatBusinessDateForFilename(issuedAt)}.pdf`;
}
