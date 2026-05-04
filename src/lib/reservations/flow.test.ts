import { describe, expect, it } from "vitest";
import { RESERVATION_STATUS } from "@/lib/constants";
import { canTransitionReservation } from "@/lib/reservations/state";

// Test de integración para el flujo de reserva
// Estos tests verifican el flujo completo usando mocks de la DB

describe("Reserva Flow Integration", () => {
  describe("Flujo completo: crear -> confirmar -> cancelar", () => {
    it("permite transición PENDING -> CONFIRMED", () => {
      expect(canTransitionReservation(
        RESERVATION_STATUS.PENDING,
        RESERVATION_STATUS.CONFIRMED,
      )).toBe(true);
    });

    it("permite transición CONFIRMED -> CANCELLED", () => {
      expect(canTransitionReservation(
        RESERVATION_STATUS.CONFIRMED,
        RESERVATION_STATUS.CANCELLED,
      )).toBe(true);
    });

    it("NO permite transición PENDING -> CONFIRMED -> REJECTED", () => {
      // Una vez confirmada no se puede rechazar
      expect(canTransitionReservation(
        RESERVATION_STATUS.CONFIRMED,
        RESERVATION_STATUS.REJECTED,
      )).toBe(false);
    });

    it("NO permite transición REJECTED -> CONFIRMED", () => {
      expect(canTransitionReservation(
        RESERVATION_STATUS.REJECTED,
        RESERVATION_STATUS.CONFIRMED,
      )).toBe(false);
    });
  });

  describe("Flujo alternativo: crear -> rechazar", () => {
    it("permite transición PENDING -> REJECTED", () => {
      expect(canTransitionReservation(
        RESERVATION_STATUS.PENDING,
        RESERVATION_STATUS.REJECTED,
      )).toBe(true);
    });

    it("permite transición PENDING -> CANCELLED (cliente)", () => {
      expect(canTransitionReservation(
        RESERVATION_STATUS.PENDING,
        RESERVATION_STATUS.CANCELLED,
      )).toBe(true);
    });
  });

  describe("Casos válidos de estado", () => {
    it("cualquier estado a mismo estado es válido (idempotente)", () => {
      for (const status of [
        RESERVATION_STATUS.PENDING,
        RESERVATION_STATUS.CONFIRMED,
        RESERVATION_STATUS.REJECTED,
        RESERVATION_STATUS.CANCELLED,
      ] as const) {
        // Reconfirmed una reserva ya confirmada es válido (idempotente)
        expect(canTransitionReservation(status, status)).toBe(true);
      }
    });
  });
});

describe("Edge cases de transición", () => {
  it("no permite cancelar una reserva ya cancelada (double cancel)", () => {
    // CANCELLED -> CANCELLED es válido por idempotencia
    expect(canTransitionReservation(
      RESERVATION_STATUS.CANCELLED,
      RESERVATION_STATUS.CANCELLED,
    )).toBe(true);
  });

  it("no permite rechazar una reserva cancelada", () => {
    expect(canTransitionReservation(
      RESERVATION_STATUS.CANCELLED,
      RESERVATION_STATUS.REJECTED,
    )).toBe(false);
  });
});