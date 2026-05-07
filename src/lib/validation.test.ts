import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formDataToRecord, loginSchema, reservationRequestSchema } from "@/lib/validation";

// Caso borde: 02:00 UTC del 4 de mayo es todavía 21:00 del 3 de mayo en
// America/Bogota (UTC-5). En UTC "hoy" sería 2026-05-04, pero la regla del
// negocio considera "hoy" = 2026-05-03. Anclar el reloj acá nos permite
// validar la zona horaria sin depender de la hora real del runner.
const FROZEN_INSTANT = new Date("2026-05-04T02:00:00.000Z");
const BOGOTA_TODAY = "2026-05-03";
const BOGOTA_YESTERDAY = "2026-05-02";
const BOGOTA_TOMORROW = "2026-05-04";
const FAR_FUTURE = "2026-12-31";

const baseInput = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  reservationTime: "20:00",
  partySize: "4",
  area: "Patio",
  reason: "Ocasional",
  country: "Colombia (+57)",
  phone: "3001234567",
  isAdult: "on",
  dataConsent: "on",
};

describe("reservationRequestSchema (con reloj fijado a Bogotá borde-de-día)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_INSTANT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("acepta una reserva para hoy según calendario America/Bogota", () => {
    const result = reservationRequestSchema.safeParse({ ...baseInput, reservationDate: BOGOTA_TODAY });
    expect(result.success).toBe(true);
  });

  it("rechaza una reserva para ayer según calendario America/Bogota", () => {
    const result = reservationRequestSchema.safeParse({ ...baseInput, reservationDate: BOGOTA_YESTERDAY });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/hoy o futura/);
    }
  });

  it("acepta una reserva para mañana en Bogotá (hoy en UTC) sin confundir zonas", () => {
    const result = reservationRequestSchema.safeParse({ ...baseInput, reservationDate: BOGOTA_TOMORROW });
    expect(result.success).toBe(true);
  });

  it("acepta una fecha futura lejana", () => {
    const result = reservationRequestSchema.safeParse({ ...baseInput, reservationDate: FAR_FUTURE });
    expect(result.success).toBe(true);
  });

  it("normaliza email y coerciona partySize", () => {
    const result = reservationRequestSchema.safeParse({
      ...baseInput,
      email: "ADA@EXAMPLE.COM",
      reservationDate: FAR_FUTURE,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ada@example.com");
      expect(result.data.partySize).toBe(4);
    }
  });

  it("normaliza teléfono con prefijo, espacios y separadores antes de guardar", () => {
    const result = reservationRequestSchema.safeParse({
      ...baseInput,
      phone: "+57 (300) 123-4567",
      reservationDate: FAR_FUTURE,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("573001234567");
    }
  });

  it("rechaza formato inválido de fecha y hora", () => {
    const result = reservationRequestSchema.safeParse({
      ...baseInput,
      reservationDate: "10/06/2026",
      reservationTime: "25:99",
    });
    expect(result.success).toBe(false);
  });

  it("rechaza partySize fuera de rango", () => {
    const tooBig = reservationRequestSchema.safeParse({ ...baseInput, reservationDate: FAR_FUTURE, partySize: "31" });
    const tooSmall = reservationRequestSchema.safeParse({ ...baseInput, reservationDate: FAR_FUTURE, partySize: "0" });
    expect(tooBig.success).toBe(false);
    expect(tooSmall.success).toBe(false);
  });

  it("exige teléfono válido y consentimientos", () => {
    const invalidPhone = reservationRequestSchema.safeParse({ ...baseInput, reservationDate: FAR_FUTURE, phone: "abc" });
    const tooLongPhone = reservationRequestSchema.safeParse({ ...baseInput, reservationDate: FAR_FUTURE, phone: "+57 300 123 4567 9999" });
    const missingConsent = reservationRequestSchema.safeParse({ ...baseInput, reservationDate: FAR_FUTURE, dataConsent: undefined });
    expect(invalidPhone.success).toBe(false);
    expect(tooLongPhone.success).toBe(false);
    expect(missingConsent.success).toBe(false);
  });

  // Deploy-safety: el formulario público anterior NO enviaba `customerLanguage`,
  // y el rollout no debe romper esos requests; pero un valor explícito inválido
  // debe ser rechazado para no persistir basura.
  it("acepta el campo customerLanguage ausente y lo defaultea a 'es'", () => {
    const result = reservationRequestSchema.safeParse({ ...baseInput, reservationDate: FAR_FUTURE });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerLanguage).toBe("es");
    }
  });

  it("acepta customerLanguage='en' y lo preserva", () => {
    const result = reservationRequestSchema.safeParse({
      ...baseInput,
      reservationDate: FAR_FUTURE,
      customerLanguage: "en",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerLanguage).toBe("en");
    }
  });

  it("rechaza un customerLanguage no soportado como 'foo'", () => {
    const result = reservationRequestSchema.safeParse({
      ...baseInput,
      reservationDate: FAR_FUTURE,
      customerLanguage: "foo",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("normaliza el email a minúsculas", () => {
    const result = loginSchema.safeParse({ email: "Admin@Tauras.AR", password: "supersecret" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("admin@tauras.ar");
  });

  it("rechaza contraseñas cortas", () => {
    const result = loginSchema.safeParse({ email: "admin@tauras.ar", password: "short" });
    expect(result.success).toBe(false);
  });
});

describe("formDataToRecord", () => {
  it("aplana entradas de FormData a un record de strings", () => {
    const formData = new FormData();
    formData.set("name", "Ada");
    formData.set("partySize", "4");
    expect(formDataToRecord(formData)).toEqual({ name: "Ada", partySize: "4" });
  });
});
