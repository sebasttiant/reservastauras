import { describe, expect, it } from "vitest";
import { buildReservationSuccessResetUrl } from "@/app/reservation-success-reset";

describe("buildReservationSuccessResetUrl", () => {
  it("cleans created=1 while preserving valid lang=en", () => {
    expect(buildReservationSuccessResetUrl("https://tauras.test/?lang=en&created=1")).toBe("/?lang=en");
  });

  it("cleans created=1 while preserving valid lang=es", () => {
    expect(buildReservationSuccessResetUrl("https://tauras.test/?lang=es&created=1")).toBe("/?lang=es");
  });

  it("drops unsupported language values when cleaning the success state", () => {
    expect(buildReservationSuccessResetUrl("https://tauras.test/?lang=foo&created=1")).toBe("/");
  });
});
