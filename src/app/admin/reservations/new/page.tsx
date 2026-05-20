import Link from "next/link";
import { createManualReservationAction } from "@/app/actions";
import { RESERVATION_SOURCE, RESERVATION_STATUS } from "@/lib/constants";
import { requireAdmin } from "@/lib/auth";
import { MANUAL_RESERVATION_ERROR_MESSAGES, lookupMessage } from "@/lib/messages";
import { getBusinessTodayDateString } from "@/lib/reservations/business-date";
import { getActiveReservationLocations } from "@/lib/reservations/locations";

interface NewReservationPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

const RESERVATION_TIMES = [
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "23:00",
  "00:00", "01:00",
] as const;

const SOURCE_OPTIONS = [
  { value: RESERVATION_SOURCE.WHATSAPP, label: "WhatsApp" },
  { value: RESERVATION_SOURCE.PHONE, label: "Llamada" },
  { value: RESERVATION_SOURCE.INSTAGRAM, label: "Instagram" },
  { value: RESERVATION_SOURCE.FACEBOOK, label: "Facebook" },
  { value: RESERVATION_SOURCE.CRM, label: "CRM" },
  { value: RESERVATION_SOURCE.IN_PERSON, label: "Presencial" },
  { value: RESERVATION_SOURCE.OTHER, label: "Otro" },
  { value: RESERVATION_SOURCE.WEB, label: "Web" },
] as const;

export const metadata = { title: "Nueva reserva · Reservas Tauras" };
export const dynamic = "force-dynamic";

export default async function NewReservationPage({ searchParams }: NewReservationPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const locations = await getActiveReservationLocations();
  const errorMessage = lookupMessage(MANUAL_RESERVATION_ERROR_MESSAGES, params.error);
  const minimumReservationDate = getBusinessTodayDateString();

  return (
    <main className="admin-shell">
      <Link className="back-link" href="/admin">← Volver al dashboard</Link>
      <section className="card reservation-card grid" aria-label="Nueva reserva manual">
        <div className="section-heading">
          <p className="brand-kicker">Carga interna</p>
          <h1>Nueva reserva</h1>
          <p className="muted">Usá este formulario cuando la reserva ya llegó por un canal comercial.</p>
        </div>

        {errorMessage ? <p className="notice error">{errorMessage}</p> : null}

        <form action={createManualReservationAction} className="grid">
          <div className="grid two">
            <label>Origen
              <select name="source" defaultValue={RESERVATION_SOURCE.WHATSAPP} required>
                {SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label>Estado inicial
              <select name="status" defaultValue={RESERVATION_STATUS.PENDING} required>
                <option value={RESERVATION_STATUS.PENDING}>Pendiente</option>
                <option value={RESERVATION_STATUS.CONFIRMED}>Confirmada sin email automático</option>
              </select>
            </label>
            <label>Sede
              <select name="locationId" required defaultValue={locations[0]?.id ?? ""}>
                {locations.length === 0 ? <option value="" disabled>No hay sedes activas</option> : null}
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.reservationLabel}</option>
                ))}
              </select>
            </label>
            <label>Fecha<input name="reservationDate" type="date" min={minimumReservationDate} required /></label>
            <label>Hora
              <select name="reservationTime" required defaultValue="">
                <option value="" disabled>Elegí un horario</option>
                {RESERVATION_TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
              </select>
            </label>
            <label>Área<input name="area" placeholder="Ej: Terraza, salón, cualquier mesa" /></label>
            <div className="field-with-hint">
              <label>Personas<input name="partySize" type="number" min={1} max={30} defaultValue={2} required aria-describedby="admin-partySize-help" /></label>
              <p id="admin-partySize-help" className="field-hint">Ingresá el total real de asistentes, incluyendo niños.</p>
            </div>
            <label>Nombre<input name="name" required minLength={2} placeholder="Nombre del cliente" /></label>
            <label>Email<input name="email" type="email" required placeholder="cliente@email.com" /></label>
            <label>Teléfono<input name="phone" inputMode="tel" pattern="[0-9+()\s-]{7,25}" required placeholder="+57 300 123 4567" /></label>
            <label>Idioma
              <select name="customerLanguage" defaultValue="es" required>
                <option value="es">Español</option>
                <option value="en">Inglés</option>
              </select>
            </label>
          </div>
          <label>Notas internas
            <textarea name="notes" rows={4} maxLength={500} placeholder="Canal, pedido específico, contexto comercial o restricciones." />
          </label>
          <button type="submit">Crear reserva</button>
          <p className="form-note">No se envían emails al crearla. Si queda pendiente, el flujo de confirmación existente sigue disponible en el detalle.</p>
        </form>
      </section>
    </main>
  );
}
