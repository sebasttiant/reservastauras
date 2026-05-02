import { describe, expect, it } from "vitest";
import { reservationRequestSchema } from "@/lib/validation";

describe("reservationRequestSchema", () => {
  it("accepts a valid reservation request", () => {
    const result = reservationRequestSchema.safeParse({
      name: "Ada Lovelace",
      email: "ADA@EXAMPLE.COM",
      reservationDate: "2026-06-10",
      reservationTime: "20:30",
      partySize: "4",
      area: "Patio",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("ada@example.com");
  });

  it("rejects invalid date and time values", () => {
    const result = reservationRequestSchema.safeParse({
      name: "A",
      email: "bad-email",
      reservationDate: "10/06/2026",
      reservationTime: "25:99",
      partySize: "0",
    });

    expect(result.success).toBe(false);
  });
});
