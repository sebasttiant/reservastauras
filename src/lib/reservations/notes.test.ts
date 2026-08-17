import { describe, expect, it } from "vitest";
import { parseReservationNotes } from "@/lib/reservations/notes";

describe("parseReservationNotes", () => {
  it("splits the composed public reservation note into reason, country and remaining notes", () => {
    const parsed = parseReservationNotes(
      "Motivo: Ocasional\nPaís: Colombia (+57)\nEspecificaciones: Sin especificaciones adicionales.",
    );

    expect(parsed).toEqual({
      reason: "Ocasional",
      country: "Colombia (+57)",
      notes: "Sin especificaciones adicionales.",
    });
  });

  it("keeps every line of a multi-line specification block", () => {
    const parsed = parseReservationNotes(
      "Motivo: Cumpleaños\nPaís: México (+52)\nEspecificaciones: Queremos ver la final\ndel mundial, cualquier mesa\ncerca de una pantalla está bien.",
    );

    expect(parsed.reason).toBe("Cumpleaños");
    expect(parsed.country).toBe("México (+52)");
    expect(parsed.notes).toBe(
      "Queremos ver la final\ndel mundial, cualquier mesa\ncerca de una pantalla está bien.",
    );
  });

  it("preserves the rejection prefix that is prepended above the composed block", () => {
    const parsed = parseReservationNotes(
      "RECHAZO: No hay disponibilidad\n\nMotivo: Ocasional\nPaís: Estados Unidos (+1)\nEspecificaciones: Mesa cerca de la ventana",
    );

    expect(parsed.reason).toBe("Ocasional");
    expect(parsed.country).toBe("Estados Unidos (+1)");
    expect(parsed.notes).toBe("RECHAZO: No hay disponibilidad\n\nMesa cerca de la ventana");
  });

  it("leaves free-form notes untouched when there is no composed block", () => {
    const parsed = parseReservationNotes("Cliente habitual, mesa 12");

    expect(parsed).toEqual({
      reason: "",
      country: "",
      notes: "Cliente habitual, mesa 12",
    });
  });

  it("extracts whichever labels are present when the block is partial", () => {
    const parsed = parseReservationNotes("Motivo: Corporativo\nEspecificaciones: Factura a nombre de ACME");

    expect(parsed).toEqual({
      reason: "Corporativo",
      country: "",
      notes: "Factura a nombre de ACME",
    });
  });

  it("returns empty fields for null or blank notes", () => {
    expect(parseReservationNotes(null)).toEqual({ reason: "", country: "", notes: "" });
    expect(parseReservationNotes("   ")).toEqual({ reason: "", country: "", notes: "" });
  });

  it("normalizes CRLF line endings", () => {
    const parsed = parseReservationNotes(
      "Motivo: Ocasional\r\nPaís: Colombia (+57)\r\nEspecificaciones: Terraza",
    );

    expect(parsed).toEqual({
      reason: "Ocasional",
      country: "Colombia (+57)",
      notes: "Terraza",
    });
  });

  it("only consumes the first occurrence of each label", () => {
    const parsed = parseReservationNotes(
      "Motivo: Ocasional\nPaís: Colombia (+57)\nEspecificaciones: Pedido\nMotivo: repetido",
    );

    expect(parsed.reason).toBe("Ocasional");
    expect(parsed.notes).toBe("Pedido\nMotivo: repetido");
  });
});

describe("parseReservationNotes — round trip with the export presentation", () => {
  it("rebuilds a block equivalent to the original when re-joined", () => {
    const original = "Motivo: Ocasional\nPaís: Colombia (+57)\nEspecificaciones: Terraza";
    const { reason, country, notes } = parseReservationNotes(original);

    expect([`Motivo: ${reason}`, `País: ${country}`, `Especificaciones: ${notes}`].join("\n")).toBe(
      original,
    );
  });
});
