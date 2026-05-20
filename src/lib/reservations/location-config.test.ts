import { describe, expect, it } from "vitest";
import {
  LOCATION_SLUGS,
  getLocationAreaValues,
  getLocationTimeOptions,
  isLocationAreaAllowed,
  isLocationOpenOnDate,
  isLocationTimeAllowed,
} from "@/lib/reservations/location-config";

describe("reservation location config", () => {
  it("keeps Steakhouse open every day with its production areas and times", () => {
    expect(getLocationAreaValues(LOCATION_SLUGS.STEAKHOUSE)).toEqual([
      "Cualquier Mesa Disponible",
      "Terraza",
      "Pasillo",
      "Patio",
      "Barra",
    ]);
    expect(isLocationOpenOnDate(LOCATION_SLUGS.STEAKHOUSE, "2026-05-18")).toBe(true);
    expect(isLocationTimeAllowed(LOCATION_SLUGS.STEAKHOUSE, "21:00")).toBe(true);
    expect(isLocationTimeAllowed(LOCATION_SLUGS.STEAKHOUSE, "21:30")).toBe(false);
  });

  it("keeps Bar & Lounge as a single-zone location", () => {
    expect(getLocationAreaValues(LOCATION_SLUGS.BAR_LOUNGE)).toEqual(["Tauras Bar & Lounge"]);
    expect(isLocationAreaAllowed(LOCATION_SLUGS.BAR_LOUNGE, "Tauras Bar & Lounge")).toBe(true);
    expect(isLocationAreaAllowed(LOCATION_SLUGS.BAR_LOUNGE, "Barra")).toBe(false);
  });

  it("keeps Tex Mex open Wednesday to Sunday with its own areas and times", () => {
    expect(getLocationAreaValues(LOCATION_SLUGS.TEX_MEX)).toEqual([
      "Cualquier Mesa Disponible",
      "Terraza",
      "Pasillo",
      "Salón",
      "Barra",
    ]);
    expect(getLocationTimeOptions(LOCATION_SLUGS.TEX_MEX)).toEqual([
      "12:00",
      "12:30",
      "13:00",
      "13:30",
      "14:00",
      "14:30",
      "15:00",
      "15:30",
      "16:00",
      "16:30",
      "17:00",
    ]);
    expect(isLocationOpenOnDate(LOCATION_SLUGS.TEX_MEX, "2026-05-18")).toBe(false);
    expect(isLocationOpenOnDate(LOCATION_SLUGS.TEX_MEX, "2026-05-20")).toBe(true);
    expect(isLocationTimeAllowed(LOCATION_SLUGS.TEX_MEX, "17:00")).toBe(true);
    expect(isLocationTimeAllowed(LOCATION_SLUGS.TEX_MEX, "17:30")).toBe(false);
    expect(isLocationAreaAllowed(LOCATION_SLUGS.TEX_MEX, "Patio")).toBe(false);
  });
});
