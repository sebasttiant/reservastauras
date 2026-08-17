import { describe, expect, it } from "vitest";
import {
  buildReservationExportRows,
  formatExportNotesBlock,
  type ReservationExportRecord,
} from "@/lib/reservations/export-data";

function makeRecord(overrides: Partial<ReservationExportRecord> = {}): ReservationExportRecord {
  return {
    id: "res-1",
    reservationDate: new Date("2026-08-14T00:00:00.000Z"),
    reservationTime: "20:00",
    area: "Terraza",
    partySize: 4,
    status: "CONFIRMED",
    source: "web",
    notes: null,
    emailError: null,
    createdAt: new Date("2026-08-10T15:00:00.000Z"),
    updatedAt: new Date("2026-08-10T15:00:00.000Z"),
    confirmedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    landingVenue: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmContent: null,
    utmTerm: null,
    user: { name: "Ana", email: "ana@example.com", phone: "+57 300 000 0000" },
    location: { reservationLabel: "Tauras Centro" },
    confirmedBy: null,
    createdByAdmin: null,
    ...overrides,
  };
}

describe("buildReservationExportRows — notes split", () => {
  it("exposes Motivo and País as their own columns and leaves the rest in Notas", () => {
    const [row] = buildReservationExportRows([
      makeRecord({
        notes: "Motivo: Ocasional\nPaís: Colombia (+57)\nEspecificaciones: Mesa cerca de la ventana",
      }),
    ]);

    expect(row.Motivo).toBe("Ocasional");
    expect(row["País"]).toBe("Colombia (+57)");
    expect(row.Notas).toBe("Mesa cerca de la ventana");
  });

  it("orders Motivo and País immediately before Notas so the sheet reads left to right", () => {
    const [row] = buildReservationExportRows([makeRecord()]);
    const keys = Object.keys(row);

    expect(keys.indexOf("Motivo")).toBe(keys.indexOf("Notas") - 2);
    expect(keys.indexOf("País")).toBe(keys.indexOf("Notas") - 1);
  });

  it("keeps free-form notes in Notas with empty Motivo and País", () => {
    const [row] = buildReservationExportRows([makeRecord({ notes: "Cliente habitual, mesa 12" })]);

    expect(row.Motivo).toBe("");
    expect(row["País"]).toBe("");
    expect(row.Notas).toBe("Cliente habitual, mesa 12");
  });

  it("emits empty strings for reservations without notes", () => {
    const [row] = buildReservationExportRows([makeRecord({ notes: null })]);

    expect(row.Motivo).toBe("");
    expect(row["País"]).toBe("");
    expect(row.Notas).toBe("");
  });
});

describe("formatExportNotesBlock", () => {
  it("recomposes the labelled block for the PDF so no field is lost", () => {
    expect(
      formatExportNotesBlock({
        Motivo: "Ocasional",
        "País": "Colombia (+57)",
        Notas: "Mesa cerca de la ventana",
      }),
    ).toBe("Motivo: Ocasional\nPaís: Colombia (+57)\nMesa cerca de la ventana");
  });

  it("omits labels that are empty", () => {
    expect(formatExportNotesBlock({ Motivo: "", "País": "", Notas: "Cliente habitual" })).toBe(
      "Cliente habitual",
    );
  });

  it("falls back to a dash when there is nothing to show", () => {
    expect(formatExportNotesBlock({ Motivo: "", "País": "", Notas: "" })).toBe("-");
  });
});
