import { describe, expect, it } from "vitest";
import { getClearReservationsInstructions, hasClearReservationsConfirmation } from "../../../scripts/clear-reservations";

describe("clear-reservations guardrail", () => {
  it("rechaza la limpieza sin confirmación explícita", () => {
    expect(hasClearReservationsConfirmation({}, [])).toBe(false);
  });

  it("acepta confirmación por variable de entorno exacta", () => {
    expect(hasClearReservationsConfirmation({ CONFIRM_CLEAR_RESERVATIONS: "true" }, [])).toBe(true);
    expect(hasClearReservationsConfirmation({ CONFIRM_CLEAR_RESERVATIONS: "1" }, [])).toBe(false);
  });

  it("acepta confirmación por argumento explícito", () => {
    expect(hasClearReservationsConfirmation({}, ["--confirm-clear-reservations"])).toBe(true);
  });

  it("documenta el comando seguro", () => {
    expect(getClearReservationsInstructions()).toContain("CONFIRM_CLEAR_RESERVATIONS=true pnpm db:clear-reservations");
  });
});
