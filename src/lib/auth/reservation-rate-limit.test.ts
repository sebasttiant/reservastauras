import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { checkReservationRateLimit, __testing } = await import("@/lib/auth/reservation-rate-limit");

describe("checkReservationRateLimit", () => {
  beforeEach(() => {
    __testing.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("permite los primeros intentos hasta el máximo configurado", () => {
    const ipKey = "203.0.113.10";
    const now = 1_000_000;

    for (let i = 0; i < __testing.policy.max; i += 1) {
      expect(checkReservationRateLimit({ ipKey, now: now + i })).toEqual({ allowed: true });
    }
  });

  it("bloquea cuando se supera el máximo dentro de la ventana", () => {
    const ipKey = "203.0.113.10";
    const now = 1_000_000;

    for (let i = 0; i < __testing.policy.max; i += 1) {
      checkReservationRateLimit({ ipKey, now: now + i });
    }

    const result = checkReservationRateLimit({ ipKey, now: now + __testing.policy.max });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe("rate-limited");
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("permite de nuevo cuando los stamps salieron de la ventana", () => {
    const ipKey = "203.0.113.10";
    const start = 1_000_000;

    for (let i = 0; i < __testing.policy.max; i += 1) {
      checkReservationRateLimit({ ipKey, now: start + i });
    }

    const future = start + __testing.policy.windowMs + 1;
    expect(checkReservationRateLimit({ ipKey, now: future })).toEqual({ allowed: true });
  });

  it("aisla buckets por IP: el bloqueo de una no afecta a otra", () => {
    const now = 1_000_000;

    for (let i = 0; i < __testing.policy.max; i += 1) {
      checkReservationRateLimit({ ipKey: "203.0.113.10", now: now + i });
    }
    expect(checkReservationRateLimit({ ipKey: "203.0.113.10", now: now + __testing.policy.max }).allowed).toBe(false);

    expect(checkReservationRateLimit({ ipKey: "198.51.100.20", now: now + __testing.policy.max })).toEqual({ allowed: true });
  });

  it("permite cuando no hay IP confiable: prefiere falso negativo a clave inventada", () => {
    expect(checkReservationRateLimit({ ipKey: null, now: 1_000_000 })).toEqual({ allowed: true });
  });
});
