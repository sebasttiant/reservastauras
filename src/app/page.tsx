import { createReservationAction } from "@/app/actions";

interface HomePageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;

  return (
    <main>
      <section className="card grid">
        <div>
          <p className="muted">Tauras</p>
          <h1>Reservá tu lugar</h1>
          <p className="muted">La solicitud queda pendiente hasta que el equipo confirme disponibilidad.</p>
        </div>

        {params.created ? <p className="notice">Recibimos tu solicitud. Te avisamos cuando esté confirmada.</p> : null}
        {params.error ? <p className="notice error">{params.error}</p> : null}

        <form action={createReservationAction} className="grid">
          <div className="grid two">
            <label>Nombre<input name="name" required minLength={2} /></label>
            <label>Email<input name="email" type="email" required /></label>
            <label>Teléfono<input name="phone" /></label>
            <label>Cantidad de personas<input name="partySize" type="number" min={1} max={30} required /></label>
            <label>Fecha<input name="reservationDate" type="date" required /></label>
            <label>Hora<input name="reservationTime" type="time" required /></label>
            <label>Área<input name="area" placeholder="Salón, patio, terraza..." /></label>
          </div>
          <label>Notas<textarea name="notes" rows={4} maxLength={500} /></label>
          <button type="submit">Solicitar reserva</button>
        </form>
      </section>
    </main>
  );
}
