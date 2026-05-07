import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RESERVATION_STATUS } from "@/lib/constants";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  headers: vi.fn(),
  requireAdmin: vi.fn(),
  isValidAdminMutationOrigin: vi.fn(),
  getRequestSecurityContext: vi.fn(),
  recordAuditLog: vi.fn(),
  sendReservationConfirmationEmail: vi.fn(),
  sendReservationRejectionEmail: vi.fn(),
  sendReservationCancellationEmail: vi.fn(),
  transaction: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  reservationFindUnique: vi.fn(),
  reservationUpdate: vi.fn(),
  reservationCreate: vi.fn(),
  userUpsert: vi.fn(),
  checkReservationRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
  requireSuperAdmin: vi.fn(),
  signInAdmin: vi.fn(),
  signOutAdmin: vi.fn(),
}));

vi.mock("@/lib/security/request", () => ({
  getRequestSecurityContext: mocks.getRequestSecurityContext,
  isValidAdminMutationOrigin: mocks.isValidAdminMutationOrigin,
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_EVENT: {
    RESERVATION_CONFIRMED: "RESERVATION_CONFIRMED",
    RESERVATION_REJECTED: "RESERVATION_REJECTED",
    RESERVATION_CANCELLED: "RESERVATION_CANCELLED",
  },
  recordAuditLog: mocks.recordAuditLog,
}));

vi.mock("@/lib/email", () => ({
  sendReservationCancellationEmail: mocks.sendReservationCancellationEmail,
  sendReservationConfirmationEmail: mocks.sendReservationConfirmationEmail,
  sendReservationRejectionEmail: mocks.sendReservationRejectionEmail,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
    reservation: {
      findUnique: mocks.reservationFindUnique,
      update: mocks.reservationUpdate,
      create: mocks.reservationCreate,
    },
    user: {
      upsert: mocks.userUpsert,
    },
    admin: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/reservation-rate-limit", () => ({
  checkReservationRateLimit: mocks.checkReservationRateLimit,
}));

vi.mock("@/lib/auth/client-ip", () => ({
  getClientIp: mocks.getClientIp,
}));

describe("confirmReservationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers({ origin: "https://tauras.test" }));
    mocks.requireAdmin.mockResolvedValue({
      adminId: "admin-1",
      name: "Admin Tauras",
      email: "admin@tauras.test",
      role: "ADMIN",
    });
    mocks.isValidAdminMutationOrigin.mockReturnValue(true);
    mocks.getRequestSecurityContext.mockReturnValue({ ip: "127.0.0.1", userAgent: "vitest" });
    mocks.recordAuditLog.mockResolvedValue(undefined);
    mocks.sendReservationConfirmationEmail.mockResolvedValue(undefined);
    mocks.sendReservationRejectionEmail.mockResolvedValue(undefined);
    mocks.sendReservationCancellationEmail.mockResolvedValue(undefined);
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`redirect:${url}`);
    });
  });

  it("confirms a pending reservation without querying for same-slot confirmed reservations", async () => {
    const reservationDate = new Date("2026-06-10T00:00:00Z");
    const pendingReservation = {
      id: "reservation-1",
      userId: "user-1",
      reservationDate,
      reservationTime: "20:00",
      area: "Patio",
      partySize: 4,
      notes: null,
      status: RESERVATION_STATUS.PENDING,
      confirmedAt: null,
      confirmedById: null,
      rejectedAt: null,
      cancelledAt: null,
      emailError: null,
      createdAt: new Date("2026-06-01T00:00:00Z"),
    };
    const confirmedReservation = {
      ...pendingReservation,
      status: RESERVATION_STATUS.CONFIRMED,
      confirmedAt: new Date("2026-06-02T00:00:00Z"),
      confirmedById: "admin-1",
      user: {
        id: "user-1",
        name: "Cliente Tauras",
        email: "cliente@tauras.test",
        phone: null,
        createdAt: new Date("2026-06-01T00:00:00Z"),
      },
    };
    const tx = {
      reservation: {
        findUnique: mocks.findUnique,
        update: mocks.update,
      },
    };

    mocks.findUnique.mockResolvedValue(pendingReservation);
    mocks.update.mockResolvedValue(confirmedReservation);
    mocks.transaction.mockImplementation(async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx));

    const formData = new FormData();
    formData.set("reservationId", "reservation-1");

    const { confirmReservationAction } = await import("@/app/actions");

    await expect(confirmReservationAction(formData)).rejects.toThrow("redirect:/admin/reservations/reservation-1?ok=confirmed");

    expect(mocks.findUnique).toHaveBeenCalledWith({ where: { id: "reservation-1" } });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "reservation-1" },
      data: {
        status: RESERVATION_STATUS.CONFIRMED,
        confirmedAt: expect.any(Date),
        confirmedById: "admin-1",
        emailError: null,
      },
      include: { user: true },
    });
    expect(mocks.recordAuditLog).toHaveBeenCalledOnce();
    expect(mocks.sendReservationConfirmationEmail).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/reservations/reservation-1");
  });

  // El idioma del email del cliente sale de la columna `customerLanguage`
  // de la reserva, normalizado defensivamente con `parsePublicLanguage` por si
  // un valor legacy/corrupto entró por backfill o por una fila vieja.
  function buildConfirmFixtures(customerLanguage: string) {
    const reservationDate = new Date("2026-06-10T00:00:00Z");
    const pendingReservation = {
      id: "reservation-1",
      userId: "user-1",
      reservationDate,
      reservationTime: "20:00",
      area: "Patio",
      partySize: 4,
      notes: null,
      status: RESERVATION_STATUS.PENDING,
      customerLanguage,
      confirmedAt: null,
      confirmedById: null,
      rejectedAt: null,
      cancelledAt: null,
      emailError: null,
      createdAt: new Date("2026-06-01T00:00:00Z"),
    };
    const confirmedReservation = {
      ...pendingReservation,
      status: RESERVATION_STATUS.CONFIRMED,
      confirmedAt: new Date("2026-06-02T00:00:00Z"),
      confirmedById: "admin-1",
      user: {
        id: "user-1",
        name: "Cliente Tauras",
        email: "cliente@tauras.test",
        phone: null,
        createdAt: new Date("2026-06-01T00:00:00Z"),
      },
    };
    const tx = {
      reservation: {
        findUnique: mocks.findUnique,
        update: mocks.update,
      },
    };
    mocks.findUnique.mockResolvedValue(pendingReservation);
    mocks.update.mockResolvedValue(confirmedReservation);
    mocks.transaction.mockImplementation(
      async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx),
    );
  }

  it("forwards the reservation's customerLanguage='en' to the confirmation email", async () => {
    buildConfirmFixtures("en");
    const formData = new FormData();
    formData.set("reservationId", "reservation-1");

    const { confirmReservationAction } = await import("@/app/actions");
    await expect(confirmReservationAction(formData)).rejects.toThrow(
      "redirect:/admin/reservations/reservation-1?ok=confirmed",
    );

    expect(mocks.sendReservationConfirmationEmail).toHaveBeenCalledOnce();
    const [arg] = mocks.sendReservationConfirmationEmail.mock.calls[0] as [{ language: string }];
    expect(arg.language).toBe("en");
  });

  it("defensively falls back to 'es' when customerLanguage is unsupported", async () => {
    // Cinturón y tirantes: aunque el schema valida 'es'|'en' al persistir, una
    // fila vieja o un backfill podría tener cualquier string. El parser debe
    // normalizar a 'es' antes de mandar el email.
    buildConfirmFixtures("fr");
    const formData = new FormData();
    formData.set("reservationId", "reservation-1");

    const { confirmReservationAction } = await import("@/app/actions");
    await expect(confirmReservationAction(formData)).rejects.toThrow(
      "redirect:/admin/reservations/reservation-1?ok=confirmed",
    );

    expect(mocks.sendReservationConfirmationEmail).toHaveBeenCalledOnce();
    const [arg] = mocks.sendReservationConfirmationEmail.mock.calls[0] as [{ language: string }];
    expect(arg.language).toBe("es");
  });
});

describe("rejectReservationAction (bilingual email wiring)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers({ origin: "https://tauras.test" }));
    mocks.requireAdmin.mockResolvedValue({
      adminId: "admin-1",
      name: "Admin Tauras",
      email: "admin@tauras.test",
      role: "ADMIN",
    });
    mocks.isValidAdminMutationOrigin.mockReturnValue(true);
    mocks.getRequestSecurityContext.mockReturnValue({ ip: "127.0.0.1", userAgent: "vitest" });
    mocks.recordAuditLog.mockResolvedValue(undefined);
    mocks.sendReservationRejectionEmail.mockResolvedValue(undefined);
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`redirect:${url}`);
    });
  });

  it("forwards customerLanguage='en' and the staff reason verbatim", async () => {
    mocks.reservationFindUnique.mockResolvedValue({
      id: "reservation-2",
      userId: "user-2",
      reservationDate: new Date("2026-06-10T00:00:00Z"),
      reservationTime: "20:00",
      area: "Patio",
      partySize: 2,
      notes: "Motivo: Cumple\nPaís: Colombia (+57)\nEspecificaciones: -",
      status: RESERVATION_STATUS.PENDING,
      customerLanguage: "en",
      user: {
        id: "user-2",
        name: "Client",
        email: "client@tauras.test",
        phone: null,
      },
    });
    mocks.reservationUpdate.mockResolvedValue({ id: "reservation-2" });

    const formData = new FormData();
    formData.set("reservationId", "reservation-2");
    formData.set("reason", "El restaurante está cerrado por feriado");

    const { rejectReservationAction } = await import("@/app/actions");
    await expect(rejectReservationAction(formData)).rejects.toThrow(
      "redirect:/admin/reservations/reservation-2?ok=rejected",
    );

    expect(mocks.sendReservationRejectionEmail).toHaveBeenCalledOnce();
    const [arg] = mocks.sendReservationRejectionEmail.mock.calls[0] as [
      { language: string; reason?: string },
    ];
    expect(arg.language).toBe("en");
    // El motivo del staff NUNCA se traduce: pasa raw al email.
    expect(arg.reason).toBe("El restaurante está cerrado por feriado");
  });
});

describe("cancelReservationAction (bilingual email wiring)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers({ origin: "https://tauras.test" }));
    mocks.requireAdmin.mockResolvedValue({
      adminId: "admin-1",
      name: "Admin Tauras",
      email: "admin@tauras.test",
      role: "ADMIN",
    });
    mocks.isValidAdminMutationOrigin.mockReturnValue(true);
    mocks.getRequestSecurityContext.mockReturnValue({ ip: "127.0.0.1", userAgent: "vitest" });
    mocks.recordAuditLog.mockResolvedValue(undefined);
    mocks.sendReservationCancellationEmail.mockResolvedValue(undefined);
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`redirect:${url}`);
    });
  });

  it("forwards customerLanguage='en' to the cancellation email", async () => {
    mocks.reservationFindUnique.mockResolvedValue({
      id: "reservation-3",
      userId: "user-3",
      reservationDate: new Date("2026-06-10T00:00:00Z"),
      reservationTime: "20:00",
      area: "Patio",
      partySize: 2,
      notes: null,
      status: RESERVATION_STATUS.PENDING,
      customerLanguage: "en",
      user: {
        id: "user-3",
        name: "Client",
        email: "client@tauras.test",
        phone: null,
      },
    });
    mocks.reservationUpdate.mockResolvedValue({ id: "reservation-3" });

    const formData = new FormData();
    formData.set("reservationId", "reservation-3");

    const { cancelReservationAction } = await import("@/app/actions");
    await expect(cancelReservationAction(formData)).rejects.toThrow(
      "redirect:/admin/reservations/reservation-3?ok=cancelled",
    );

    expect(mocks.sendReservationCancellationEmail).toHaveBeenCalledOnce();
    const [arg] = mocks.sendReservationCancellationEmail.mock.calls[0] as [{ language: string }];
    expect(arg.language).toBe("en");
  });
});

describe("createReservationAction (persistencia bilingüe + redirects saneados)", () => {
  // Reloj congelado para que las fechas futuras del schema validen
  // independientemente del runner. Bogotá es UTC-5, así que un input fechado
  // como "2026-12-31" siempre va a ser "futuro" respecto a este instante.
  const FROZEN_INSTANT = new Date("2026-05-04T02:00:00.000Z");
  const FAR_FUTURE = "2026-12-31";

  const baseFields = {
    name: "Ada Lovelace",
    email: "ada@example.com",
    phone: "3001234567",
    country: "Colombia (+57)",
    reservationDate: FAR_FUTURE,
    reservationTime: "20:00",
    area: "Patio",
    reason: "Ocasional",
    partySize: "4",
    notes: "Mesa cerca de la ventana",
    isAdult: "on",
    dataConsent: "on",
  };

  function buildFormData(extra: Record<string, string> = {}): FormData {
    const formData = new FormData();
    for (const [key, value] of Object.entries({ ...baseFields, ...extra })) {
      formData.set(key, value);
    }
    return formData;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_INSTANT);

    mocks.headers.mockResolvedValue(new Headers({ origin: "https://tauras.test" }));
    mocks.getClientIp.mockReturnValue("203.0.113.10");
    mocks.checkReservationRateLimit.mockReturnValue({ allowed: true });
    mocks.userUpsert.mockResolvedValue({ id: "user-1", email: "ada@example.com", name: "Ada Lovelace", phone: "3001234567" });
    mocks.reservationCreate.mockResolvedValue({ id: "reservation-1" });
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`redirect:${url}`);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persiste customerLanguage='en' y redirige con `lang=en` cuando el cliente eligió inglés", async () => {
    const formData = buildFormData({ customerLanguage: "en", lang: "en" });
    const { createReservationAction } = await import("@/app/actions");

    await expect(createReservationAction(formData)).rejects.toThrow("redirect:/?created=1&lang=en");

    expect(mocks.reservationCreate).toHaveBeenCalledTimes(1);
    const createArgs = mocks.reservationCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(createArgs.data.customerLanguage).toBe("en");
    // Las notas se mantienen en español/internal: nada de copy traducido en
    // valores almacenados, ni en motivo/país/notas.
    expect(createArgs.data.notes).toBe(
      "Motivo: Ocasional\nPaís: Colombia (+57)\nEspecificaciones: Mesa cerca de la ventana",
    );
    expect(createArgs.data.area).toBe("Patio");
  });

  it("acepta el formulario actual sin customerLanguage y persiste 'es' por default", async () => {
    // Caso de compatibilidad: la persistencia se deploya antes que la UI bilingüe.
    // El formulario actual NO envía `customerLanguage`; ese request debe seguir
    // funcionando y guardarse como español.
    const formData = buildFormData();
    const { createReservationAction } = await import("@/app/actions");

    await expect(createReservationAction(formData)).rejects.toThrow("redirect:/?created=1");

    const createArgs = mocks.reservationCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(createArgs.data.customerLanguage).toBe("es");
  });

  it("rechaza un customerLanguage POSTeado inválido y NO crea la reserva", async () => {
    const formData = buildFormData({ customerLanguage: "foo" });
    const { createReservationAction } = await import("@/app/actions");

    await expect(createReservationAction(formData)).rejects.toThrow("redirect:/?error=invalid-data");
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
  });

  it("no propaga `lang=fr` (no soportado) en el redirect público de error", async () => {
    // Si el cliente intenta meter un idioma raro vía URL para envenenar el
    // redirect (open-redirect-style o pintar un `lang` inexistente), el server
    // debe ignorarlo y caer al default. El redirect resultante NO incluye
    // `lang=fr`.
    const formData = buildFormData({ customerLanguage: "foo", lang: "fr" });
    const { createReservationAction } = await import("@/app/actions");

    await expect(createReservationAction(formData)).rejects.toThrow("redirect:/?error=invalid-data");
  });

  it("preserva `lang=en` en el redirect de error cuando el query es válido", async () => {
    // Si el formulario público inglés mete datos inválidos, el usuario debe
    // volver al formulario inglés, no caer abruptamente al español.
    const formData = buildFormData({ customerLanguage: "en", lang: "en", phone: "abc" });
    const { createReservationAction } = await import("@/app/actions");

    await expect(createReservationAction(formData)).rejects.toThrow("redirect:/?error=invalid-data&lang=en");
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
  });

  it("redirige con el lang saneado en el path de rate-limit, sin propagar valores raros", async () => {
    mocks.checkReservationRateLimit.mockReturnValueOnce({ allowed: false });
    const formData = buildFormData({ lang: "fr" });
    const { createReservationAction } = await import("@/app/actions");

    await expect(createReservationAction(formData)).rejects.toThrow("redirect:/?error=rate-limited");
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
  });
});
