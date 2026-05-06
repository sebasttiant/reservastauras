import { describe, expect, it } from "vitest";
import { buildReservationSlotAwarenessNotice } from "@/lib/reservations/slot-awareness";

describe("buildReservationSlotAwarenessNotice", () => {
  it("summarizes confirmed and pending reservations for the same time", () => {
    const notice = buildReservationSlotAwarenessNotice({
      confirmedReservations: 2,
      confirmedPeople: 7,
      pendingReservations: 1,
      pendingPeople: 4,
    });

    expect(notice.tone).toBe("warning");
    expect(notice.title).toBe("Revisá disponibilidad real de mesas");
    expect(notice.summary).toBe("Ya hay 2 reservas confirmadas (7 personas) en esta misma zona, fecha y horario. También hay 1 solicitud pendiente (4 personas) para revisar.");
    expect(notice.advisory).toBe("No bloquea la confirmación; es una alerta para revisar disponibilidad real de mesas en sitio.");
  });

  it("returns a reassuring notice when the time has no other active requests", () => {
    const notice = buildReservationSlotAwarenessNotice({
      confirmedReservations: 0,
      confirmedPeople: 0,
      pendingReservations: 0,
      pendingPeople: 0,
    });

    expect(notice.tone).toBe("reassuring");
    expect(notice.title).toBe("No hay reservas cruzadas en este horario");
    expect(notice.summary).toBe("No hay otras reservas confirmadas ni solicitudes pendientes para esa misma zona, fecha y horario.");
    expect(notice.advisory).toBe("No bloquea la confirmación; es una alerta operativa para revisar disponibilidad real de mesas en sitio.");
  });
});
