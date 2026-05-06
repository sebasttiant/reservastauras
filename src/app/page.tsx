import { createReservationAction } from "@/app/actions";
import { PUBLIC_ERROR_MESSAGES, lookupMessage } from "@/lib/messages";

const RESERVATION_TIMES = [
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "23:00",
  "00:00", "01:00",
] as const;

const COUNTRIES = [
  "Colombia (+57)", "Estados Unidos (+1)", "Canadá (+1)", "México (+52)",
  "Guatemala (+502)", "El Salvador (+503)", "Honduras (+504)", "Nicaragua (+505)",
  "Costa Rica (+506)", "Panamá (+507)", "Brasil (+55)", "Argentina (+54)",
  "Uruguay (+598)", "Paraguay (+595)", "Bolivia (+591)", "Chile (+56)",
  "Perú (+51)", "Venezuela (+58)", "España (+34)", "Francia (+33)",
  "Reino Unido (+44)", "Alemania (+49)", "Italia (+39)", "Portugal (+351)",
] as const;

interface HomePageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const errorMessage = lookupMessage(PUBLIC_ERROR_MESSAGES, params.error);

  return (
    <>
      <main className="hero">
        <div className="hero-shell">
          <section className="hero-copy">
            <p className="brand-kicker">Tauras Steakhouse</p>
            <h1>Reserva tu mesa con tranquilidad</h1>
            <p>
              Elige la fecha, la hora y el ambiente. Nuestro equipo revisará la agenda y te confirmará la disponibilidad para que solo tengas que disfrutar Tauras.
            </p>
            <div className="hero-highlights" aria-label="Beneficios de reservar en Tauras">
              <span>Confirmación humana</span>
              <span>Ambientes Tauras</span>
              <span>Atención personalizada</span>
            </div>
          </section>

          <section className="card reservation-card grid" aria-label="Formulario de reserva Tauras Steakhouse">
            <div className="section-heading">
              <p className="brand-kicker">Reservas</p>
              <h2>Datos de la reserva</h2>
              <p className="muted">Completa la solicitud. Si necesitamos ajustar algo, te contactaremos antes de confirmar.</p>
            </div>

            {params.created ? <p className="notice">Recibimos tu solicitud. En breve, una persona del equipo se comunicará contigo para confirmar disponibilidad.</p> : null}
            {errorMessage ? <p className="notice error">{errorMessage}</p> : null}

            <form action={createReservationAction} className="grid">
              <div className="grid two">
                <label>Zona
                  <select name="area" defaultValue="Cualquier Mesa Disponible">
                    <option value="Cualquier Mesa Disponible">Cualquier Mesa Disponible</option>
                    <option value="Terraza">Terraza</option>
                    <option value="Tauras Bar & Lounge">Tauras Bar & Lounge</option>
                    <option value="Salón Sofá">Salón Sofá</option>
                  </select>
                </label>
                <label>Cantidad de personas<input name="partySize" type="number" min={1} max={30} defaultValue={1} required /></label>
                <label>Fecha<input name="reservationDate" type="date" required /></label>
                <label>Hora disponible
                  <select name="reservationTime" required defaultValue="">
                    <option value="" disabled>Selecciona una hora</option>
                    {RESERVATION_TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
                  </select>
                </label>
                <label>Motivo de la reserva
                  <select name="reason" defaultValue="Ocasional" required>
                    <option value="Ocasional">Ocasional</option>
                    <option value="Cumpleaños">Cumpleaños</option>
                    <option value="Cita">Cita</option>
                    <option value="Aniversario">Aniversario</option>
                    <option value="Negocios">Negocios</option>
                  </select>
                </label>
                <label>Nombre<input name="name" required minLength={2} placeholder="Escribe tu nombre" /></label>
                <label>Email<input name="email" type="email" required placeholder="correo@ejemplo.com" /></label>
                <label>País
                  <select name="country" defaultValue="Colombia (+57)" required>
                    {COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
                  </select>
                </label>
                <label>Teléfono<input name="phone" inputMode="tel" pattern="[0-9+()\s-]{7,25}" required placeholder="3001234567" title="Ingresá un teléfono válido. Podés usar espacios, +, guiones o paréntesis." /></label>
              </div>
              <label>Especificaciones
                <textarea name="notes" rows={4} maxLength={500} placeholder="Intolerancias, celebración, ubicación preferida o comentario extra…" />
              </label>
              <div className="consent-grid">
                <label className="check-row"><input type="checkbox" name="isAdult" required /> Declaro que soy mayor de edad.</label>
                <label className="check-row"><input type="checkbox" name="dataConsent" required /> Autorizo el tratamiento de mis datos para gestionar la reserva.</label>
              </div>
              <button type="submit">Solicitar reserva</button>
              <p className="form-note">No es confirmación automática: cuidamos cada turno para darte una mejor experiencia.</p>
            </form>
          </section>
        </div>
      </main>
      <footer className="footer">&copy; 2026 Tauras</footer>
    </>
  );
}
