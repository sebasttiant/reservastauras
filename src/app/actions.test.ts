import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { RESERVATION_STATUS } from "@/lib/constants";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  headers: vi.fn(),
  requireAdmin: vi.fn(),
  requireSuperAdmin: vi.fn(),
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
  locationFindFirst: vi.fn(),
  userUpsert: vi.fn(),
  checkReservationRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  validateImageFile: vi.fn(),
  saveZonePhoto: vi.fn(),
  deleteZonePhoto: vi.fn(),
  toAreaSlug: vi.fn(),
  zoneFindUnique: vi.fn(),
  zoneUpsert: vi.fn(),
  zoneUpdate: vi.fn(),
  locationFindUnique: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));

vi.mock("@/lib/auth", () => ({
  requireAdmin: mocks.requireAdmin,
  requireSuperAdmin: mocks.requireSuperAdmin,
  signInAdmin: vi.fn(),
  signOutAdmin: vi.fn(),
}));

vi.mock("@/lib/security/request", () => ({
  getRequestSecurityContext: mocks.getRequestSecurityContext,
  isValidAdminMutationOrigin: mocks.isValidAdminMutationOrigin,
}));

  vi.mock("@/lib/audit", () => ({
  AUDIT_EVENT: {
    RESERVATION_MANUAL_CREATED: "RESERVATION_MANUAL_CREATED",
    RESERVATION_CONFIRMED: "RESERVATION_CONFIRMED",
    RESERVATION_CONFIRMATION_EMAIL_RESENT: "RESERVATION_CONFIRMATION_EMAIL_RESENT",
    RESERVATION_REJECTED: "RESERVATION_REJECTED",
    RESERVATION_CANCELLED: "RESERVATION_CANCELLED",
    PHOTO_UPLOADED: "PHOTO_UPLOADED",
    PHOTO_DELETED: "PHOTO_DELETED",
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
    location: {
      findFirst: mocks.locationFindFirst,
      findUnique: mocks.locationFindUnique,
    },
    user: {
      upsert: mocks.userUpsert,
    },
    admin: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    zone: {
      findUnique: mocks.zoneFindUnique,
      upsert: mocks.zoneUpsert,
      update: mocks.zoneUpdate,
    },
  },
}));

vi.mock("@/lib/auth/reservation-rate-limit", () => ({
  checkReservationRateLimit: mocks.checkReservationRateLimit,
}));

vi.mock("@/lib/auth/client-ip", () => ({
  getClientIp: mocks.getClientIp,
}));

vi.mock("@/lib/photos", () => ({
  validateImageFile: mocks.validateImageFile,
  saveZonePhoto: mocks.saveZonePhoto,
  deleteZonePhoto: mocks.deleteZonePhoto,
  toAreaSlug: mocks.toAreaSlug,
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
      include: { user: true, location: true },
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

  it("defensively falls back to 'en' when customerLanguage is unsupported", async () => {
    // Cinturón y tirantes: aunque el schema valida 'es'|'en' al persistir, una
    // fila vieja o un backfill podría tener cualquier string. El parser debe
    // normalizar a 'en' antes de mandar el email.
    buildConfirmFixtures("fr");
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
});

describe("resendConfirmationEmailAction", () => {
  type ConfirmedReservationOverrides = {
    status?: string;
    customerLanguage?: string;
    confirmedBy?: { id: string; name: string; email: string } | null;
    confirmedById?: string | null;
    emailError?: string | null;
  };

  function buildConfirmedReservation(overrides: ConfirmedReservationOverrides = {}) {
    // Importante: usamos `in` en lugar de `??` para `confirmedBy` y
    // `confirmedById` porque queremos respetar el override `null` (modela el
    // caso "el admin que confirmó fue dado de baja y la FK quedó SET NULL").
    return {
      id: "reservation-resend-1",
      userId: "user-resend-1",
      reservationDate: new Date("2026-06-10T00:00:00Z"),
      reservationTime: "20:00",
      area: "Patio",
      partySize: 4,
      notes: null,
      status: overrides.status ?? RESERVATION_STATUS.CONFIRMED,
      customerLanguage: overrides.customerLanguage ?? "es",
      confirmedAt: new Date("2026-06-02T00:00:00Z"),
      confirmedById: "confirmedById" in overrides ? overrides.confirmedById : "admin-original",
      confirmedBy: "confirmedBy" in overrides ? overrides.confirmedBy : {
        id: "admin-original",
        name: "Admin Original",
        email: "original@tauras.test",
      },
      rejectedAt: null,
      cancelledAt: null,
      emailError: overrides.emailError ?? null,
      createdAt: new Date("2026-06-01T00:00:00Z"),
      user: {
        id: "user-resend-1",
        name: "Cliente Tauras",
        email: "cliente@tauras.test",
        phone: null,
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers({ origin: "https://tauras.test" }));
    mocks.requireAdmin.mockResolvedValue({
      adminId: "admin-current",
      name: "Admin Actual",
      email: "actual@tauras.test",
      role: "ADMIN",
    });
    mocks.isValidAdminMutationOrigin.mockReturnValue(true);
    mocks.getRequestSecurityContext.mockReturnValue({ ip: "127.0.0.1", userAgent: "vitest" });
    mocks.recordAuditLog.mockResolvedValue(undefined);
    mocks.sendReservationConfirmationEmail.mockResolvedValue(undefined);
    mocks.reservationUpdate.mockResolvedValue({ id: "reservation-resend-1" });
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`redirect:${url}`);
    });
  });

  it("re-sends the email using confirmedBy as the responsible person and clears emailError on success", async () => {
    mocks.reservationFindUnique.mockResolvedValue(
      buildConfirmedReservation({ emailError: "Previous SMTP timeout" }),
    );

    const formData = new FormData();
    formData.set("reservationId", "reservation-resend-1");

    const { resendConfirmationEmailAction } = await import("@/app/actions");
    await expect(resendConfirmationEmailAction(formData)).rejects.toThrow(
      "redirect:/admin/reservations/reservation-resend-1?ok=email-resent",
    );

    expect(mocks.sendReservationConfirmationEmail).toHaveBeenCalledOnce();
    const [arg] = mocks.sendReservationConfirmationEmail.mock.calls[0] as [{
      to: string; confirmedByName: string; confirmedByEmail: string; language: string;
    }];
    expect(arg.to).toBe("cliente@tauras.test");
    expect(arg.confirmedByName).toBe("Admin Original");
    expect(arg.confirmedByEmail).toBe("original@tauras.test");
    expect(arg.language).toBe("es");

    // emailError debe limpiarse en el éxito (un envío anterior podría haber
    // dejado un mensaje pegado).
    expect(mocks.reservationUpdate).toHaveBeenCalledWith({
      where: { id: "reservation-resend-1" },
      data: { emailError: null },
    });

    expect(mocks.recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      event: "RESERVATION_CONFIRMATION_EMAIL_RESENT",
      resourceId: "reservation-resend-1",
    }));
    // outcome no se setea explícito en el éxito (audit lo defaultea a SUCCESS).
    expect(mocks.recordAuditLog.mock.calls[0]?.[0]?.outcome).toBeUndefined();
  });

  it("falls back to the current admin when confirmedBy was deleted (FK SET NULL)", async () => {
    mocks.reservationFindUnique.mockResolvedValue(
      buildConfirmedReservation({ confirmedBy: null, confirmedById: null }),
    );

    const formData = new FormData();
    formData.set("reservationId", "reservation-resend-1");

    const { resendConfirmationEmailAction } = await import("@/app/actions");
    await expect(resendConfirmationEmailAction(formData)).rejects.toThrow(
      "redirect:/admin/reservations/reservation-resend-1?ok=email-resent",
    );

    const [arg] = mocks.sendReservationConfirmationEmail.mock.calls[0] as [{
      confirmedByName: string; confirmedByEmail: string;
    }];
    expect(arg.confirmedByName).toBe("Admin Actual");
    expect(arg.confirmedByEmail).toBe("actual@tauras.test");
  });

  it("forwards customerLanguage='en' to the confirmation email on resend", async () => {
    mocks.reservationFindUnique.mockResolvedValue(
      buildConfirmedReservation({ customerLanguage: "en" }),
    );

    const formData = new FormData();
    formData.set("reservationId", "reservation-resend-1");

    const { resendConfirmationEmailAction } = await import("@/app/actions");
    await expect(resendConfirmationEmailAction(formData)).rejects.toThrow(
      "redirect:/admin/reservations/reservation-resend-1?ok=email-resent",
    );

    const [arg] = mocks.sendReservationConfirmationEmail.mock.calls[0] as [{ language: string }];
    expect(arg.language).toBe("en");
  });

  it("defensively falls back to 'en' when a resend reservation has unsupported customerLanguage", async () => {
    mocks.reservationFindUnique.mockResolvedValue(
      buildConfirmedReservation({ customerLanguage: "fr" }),
    );

    const formData = new FormData();
    formData.set("reservationId", "reservation-resend-1");

    const { resendConfirmationEmailAction } = await import("@/app/actions");
    await expect(resendConfirmationEmailAction(formData)).rejects.toThrow(
      "redirect:/admin/reservations/reservation-resend-1?ok=email-resent",
    );

    const [arg] = mocks.sendReservationConfirmationEmail.mock.calls[0] as [{ language: string }];
    expect(arg.language).toBe("en");
  });

  it("rejects reservations that are not CONFIRMED with invalid-state-resend", async () => {
    mocks.reservationFindUnique.mockResolvedValue(
      buildConfirmedReservation({ status: RESERVATION_STATUS.PENDING }),
    );

    const formData = new FormData();
    formData.set("reservationId", "reservation-resend-1");

    const { resendConfirmationEmailAction } = await import("@/app/actions");
    await expect(resendConfirmationEmailAction(formData)).rejects.toThrow(
      "redirect:/admin/reservations/reservation-resend-1?error=invalid-state-resend",
    );

    expect(mocks.sendReservationConfirmationEmail).not.toHaveBeenCalled();
    expect(mocks.reservationUpdate).not.toHaveBeenCalled();
    expect(mocks.recordAuditLog).not.toHaveBeenCalled();
  });

  it("redirects with not-found when the reservation does not exist", async () => {
    mocks.reservationFindUnique.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("reservationId", "missing");

    const { resendConfirmationEmailAction } = await import("@/app/actions");
    await expect(resendConfirmationEmailAction(formData)).rejects.toThrow(
      "redirect:/admin/reservations/missing?error=not-found",
    );

    expect(mocks.sendReservationConfirmationEmail).not.toHaveBeenCalled();
  });

  it("on SMTP failure: persists emailError, keeps status, audits FAILURE, and redirects with email-resend-failed", async () => {
    mocks.reservationFindUnique.mockResolvedValue(buildConfirmedReservation());
    mocks.sendReservationConfirmationEmail.mockRejectedValueOnce(new Error("SMTP timeout"));

    const formData = new FormData();
    formData.set("reservationId", "reservation-resend-1");

    const { resendConfirmationEmailAction } = await import("@/app/actions");
    await expect(resendConfirmationEmailAction(formData)).rejects.toThrow(
      "redirect:/admin/reservations/reservation-resend-1?error=email-resend-failed",
    );

    // Solo se persiste emailError, NUNCA status. La reserva sigue confirmada.
    expect(mocks.reservationUpdate).toHaveBeenCalledOnce();
    expect(mocks.reservationUpdate).toHaveBeenCalledWith({
      where: { id: "reservation-resend-1" },
      data: { emailError: "SMTP timeout" },
    });
    const updateArgs = mocks.reservationUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(updateArgs.data.status).toBeUndefined();

    expect(mocks.recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      event: "RESERVATION_CONFIRMATION_EMAIL_RESENT",
      outcome: "FAILURE",
      resourceId: "reservation-resend-1",
      metadata: expect.objectContaining({ error: "SMTP timeout" }),
    }));
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
    mocks.transaction.mockImplementation(async (callback: (transactionClient: {
      reservation: { findUnique: typeof mocks.reservationFindUnique; update: typeof mocks.reservationUpdate };
    }) => Promise<unknown>) => callback({
      reservation: {
        findUnique: mocks.reservationFindUnique,
        update: mocks.reservationUpdate,
      },
    }));
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
    mocks.reservationUpdate.mockResolvedValue({
      id: "reservation-2",
      reservationDate: new Date("2026-06-10T00:00:00Z"),
      reservationTime: "20:00",
      area: "Patio",
      customerLanguage: "en",
      user: { id: "user-2", name: "Client", email: "client@tauras.test", phone: null },
      location: { id: "location-1", slug: "tauras-default", name: "TAURAS", shortName: "TAURAS", reservationLabel: "TAURAS" },
    });

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
    expect(mocks.reservationUpdate).toHaveBeenCalledWith({
      where: { id: "reservation-2" },
      data: expect.objectContaining({
        status: RESERVATION_STATUS.REJECTED,
        rejectedAt: expect.any(Date),
        rejectedById: "admin-1",
        rejectionReason: "El restaurante está cerrado por feriado",
        emailError: null,
      }),
      include: { user: true, location: true },
    });
  });

  it("defensively falls back to 'en' when rejecting an unsupported reservation language", async () => {
    mocks.reservationFindUnique.mockResolvedValue({
      id: "reservation-2",
      userId: "user-2",
      reservationDate: new Date("2026-06-10T00:00:00Z"),
      reservationTime: "20:00",
      area: "Patio",
      partySize: 2,
      notes: null,
      status: RESERVATION_STATUS.PENDING,
      customerLanguage: "fr",
      user: {
        id: "user-2",
        name: "Client",
        email: "client@tauras.test",
        phone: null,
      },
    });
    mocks.reservationUpdate.mockResolvedValue({
      id: "reservation-2",
      reservationDate: new Date("2026-06-10T00:00:00Z"),
      reservationTime: "20:00",
      area: "Patio",
      customerLanguage: "fr",
      user: { id: "user-2", name: "Client", email: "client@tauras.test", phone: null },
      location: { id: "location-1", slug: "tauras-default", name: "TAURAS", shortName: "TAURAS", reservationLabel: "TAURAS" },
    });

    const formData = new FormData();
    formData.set("reservationId", "reservation-2");

    const { rejectReservationAction } = await import("@/app/actions");
    await expect(rejectReservationAction(formData)).rejects.toThrow(
      "redirect:/admin/reservations/reservation-2?ok=rejected",
    );

    const [arg] = mocks.sendReservationRejectionEmail.mock.calls[0] as [{ language: string }];
    expect(arg.language).toBe("en");
    expect(mocks.reservationUpdate).toHaveBeenCalledWith({
      where: { id: "reservation-2" },
      data: expect.objectContaining({
        status: RESERVATION_STATUS.REJECTED,
        rejectedById: "admin-1",
        rejectionReason: null,
        emailError: null,
      }),
      include: { user: true, location: true },
    });
  });

  it("redirects concurrent reject conflicts without sending email or audit", async () => {
    mocks.transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Serializable transaction conflict", {
        code: "P2034",
        clientVersion: "test",
      }),
    );

    const formData = new FormData();
    formData.set("reservationId", "reservation-2");

    const { rejectReservationAction } = await import("@/app/actions");
    await expect(rejectReservationAction(formData)).rejects.toThrow(
      "redirect:/admin/reservations/reservation-2?error=concurrent-update",
    );

    expect(mocks.sendReservationRejectionEmail).not.toHaveBeenCalled();
    expect(mocks.recordAuditLog).not.toHaveBeenCalled();
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
    mocks.transaction.mockImplementation(async (callback: (transactionClient: {
      reservation: { findUnique: typeof mocks.reservationFindUnique; update: typeof mocks.reservationUpdate };
    }) => Promise<unknown>) => callback({
      reservation: {
        findUnique: mocks.reservationFindUnique,
        update: mocks.reservationUpdate,
      },
    }));
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
    mocks.reservationUpdate.mockResolvedValue({
      id: "reservation-3",
      reservationDate: new Date("2026-06-10T00:00:00Z"),
      reservationTime: "20:00",
      area: "Patio",
      customerLanguage: "en",
      user: { id: "user-3", name: "Client", email: "client@tauras.test", phone: null },
      location: { id: "location-1", slug: "tauras-default", name: "TAURAS", shortName: "TAURAS", reservationLabel: "TAURAS" },
    });

    const formData = new FormData();
    formData.set("reservationId", "reservation-3");
    formData.set("reason", "Por solicitud del cliente");

    const { cancelReservationAction } = await import("@/app/actions");
    await expect(cancelReservationAction(formData)).rejects.toThrow(
      "redirect:/admin/reservations/reservation-3?ok=cancelled",
    );

    expect(mocks.sendReservationCancellationEmail).toHaveBeenCalledOnce();
    const [arg] = mocks.sendReservationCancellationEmail.mock.calls[0] as [{ language: string }];
    expect(arg.language).toBe("en");
    expect(mocks.reservationUpdate).toHaveBeenCalledWith({
      where: { id: "reservation-3" },
      data: expect.objectContaining({
        status: RESERVATION_STATUS.CANCELLED,
        cancelledAt: expect.any(Date),
        cancelledById: "admin-1",
        cancellationReason: "Por solicitud del cliente",
        emailError: null,
      }),
      include: { user: true, location: true },
    });
  });

  it("defensively falls back to 'en' when cancelling an unsupported reservation language", async () => {
    mocks.reservationFindUnique.mockResolvedValue({
      id: "reservation-3",
      userId: "user-3",
      reservationDate: new Date("2026-06-10T00:00:00Z"),
      reservationTime: "20:00",
      area: "Patio",
      partySize: 2,
      notes: null,
      status: RESERVATION_STATUS.PENDING,
      customerLanguage: "fr",
      user: {
        id: "user-3",
        name: "Client",
        email: "client@tauras.test",
        phone: null,
      },
    });
    mocks.reservationUpdate.mockResolvedValue({
      id: "reservation-3",
      reservationDate: new Date("2026-06-10T00:00:00Z"),
      reservationTime: "20:00",
      area: "Patio",
      customerLanguage: "fr",
      user: { id: "user-3", name: "Client", email: "client@tauras.test", phone: null },
      location: { id: "location-1", slug: "tauras-default", name: "TAURAS", shortName: "TAURAS", reservationLabel: "TAURAS" },
    });

    const formData = new FormData();
    formData.set("reservationId", "reservation-3");

    const { cancelReservationAction } = await import("@/app/actions");
    await expect(cancelReservationAction(formData)).rejects.toThrow(
      "redirect:/admin/reservations/reservation-3?ok=cancelled",
    );

    const [arg] = mocks.sendReservationCancellationEmail.mock.calls[0] as [{ language: string }];
    expect(arg.language).toBe("en");
    expect(mocks.reservationUpdate).toHaveBeenCalledWith({
      where: { id: "reservation-3" },
      data: expect.objectContaining({
        status: RESERVATION_STATUS.CANCELLED,
        cancelledById: "admin-1",
        cancellationReason: null,
        emailError: null,
      }),
      include: { user: true, location: true },
    });
  });

  it("redirects concurrent cancel conflicts without sending email or audit", async () => {
    mocks.transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Serializable transaction conflict", {
        code: "P2034",
        clientVersion: "test",
      }),
    );

    const formData = new FormData();
    formData.set("reservationId", "reservation-3");

    const { cancelReservationAction } = await import("@/app/actions");
    await expect(cancelReservationAction(formData)).rejects.toThrow(
      "redirect:/admin/reservations/reservation-3?error=concurrent-update",
    );

    expect(mocks.sendReservationCancellationEmail).not.toHaveBeenCalled();
    expect(mocks.recordAuditLog).not.toHaveBeenCalled();
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
    locationSlug: "tauras-default",
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
    mocks.locationFindFirst.mockResolvedValue({ id: "location-default" });
    mocks.reservationCreate.mockResolvedValue({ id: "reservation-1" });
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`redirect:${url}`);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persiste customerLanguage='en' y redirige sin `lang` cuando el cliente eligió inglés default", async () => {
    const formData = buildFormData({ customerLanguage: "en", lang: "en" });
    const { createReservationAction } = await import("@/app/actions");

    await expect(createReservationAction(formData)).rejects.toThrow("redirect:/?created=1");

    expect(mocks.reservationCreate).toHaveBeenCalledTimes(1);
    const createArgs = mocks.reservationCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(createArgs.data.locationId).toBe("location-default");
    expect(createArgs.data.customerLanguage).toBe("en");
    // Las notas se mantienen en español/internal: nada de copy traducido en
    // valores almacenados, ni en motivo/país/notas.
    expect(createArgs.data.notes).toBe(
      "Motivo: Ocasional\nPaís: Colombia (+57)\nEspecificaciones: Mesa cerca de la ventana",
    );
    expect(createArgs.data.area).toBe("Patio");
  });

  it("acepta el formulario actual sin customerLanguage y persiste 'en' por default", async () => {
    // Caso de compatibilidad: la persistencia se deploya antes que la UI bilingüe.
    // El formulario actual NO envía `customerLanguage`; ese request debe seguir
    // funcionando y guardarse como inglés, que es el idioma público default.
    const formData = buildFormData();
    const { createReservationAction } = await import("@/app/actions");

    await expect(createReservationAction(formData)).rejects.toThrow("redirect:/?created=1");

    const createArgs = mocks.reservationCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(createArgs.data.customerLanguage).toBe("en");
  });

  it("preserva customerLanguage='es' y `lang=es` en el redirect de éxito", async () => {
    const formData = buildFormData({ customerLanguage: "es", lang: "es" });
    const { createReservationAction } = await import("@/app/actions");

    await expect(createReservationAction(formData)).rejects.toThrow(/redirect:/);
    expect(mocks.redirect).toHaveBeenCalledWith(expect.stringContaining("created=1"));
    expect(mocks.redirect).toHaveBeenCalledWith(expect.stringContaining("lang=es"));

    const createArgs = mocks.reservationCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(createArgs.data.customerLanguage).toBe("es");
  });

  it("rechaza un customerLanguage POSTeado inválido y NO crea la reserva", async () => {
    const formData = buildFormData({ customerLanguage: "foo" });
    const { createReservationAction } = await import("@/app/actions");

    await expect(createReservationAction(formData)).rejects.toThrow("redirect:/?error=invalid-data");
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
  });

  it("rechaza una locationSlug inválida o inactiva antes de crear usuario/reserva", async () => {
    mocks.locationFindFirst.mockResolvedValueOnce(null);
    const formData = buildFormData({ locationSlug: "sede-inactiva" });
    const { createReservationAction } = await import("@/app/actions");

    await expect(createReservationAction(formData)).rejects.toThrow("redirect:/?error=invalid-data");
    expect(mocks.userUpsert).not.toHaveBeenCalled();
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

  it("omite `lang=en` en el redirect de error porque inglés es el default", async () => {
    // Si el formulario público inglés mete datos inválidos, el usuario debe
    // volver al formulario inglés, no caer abruptamente al español.
    const formData = buildFormData({ customerLanguage: "en", lang: "en", phone: "abc" });
    const { createReservationAction } = await import("@/app/actions");

    await expect(createReservationAction(formData)).rejects.toThrow("redirect:/?error=invalid-data");
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
  });

  it("preserva `lang=es` en el redirect de error cuando español fue seleccionado", async () => {
    const formData = buildFormData({ customerLanguage: "es", lang: "es", phone: "abc" });
    const { createReservationAction } = await import("@/app/actions");

    await expect(createReservationAction(formData)).rejects.toThrow("redirect:/?error=invalid-data&lang=es");
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

describe("createManualReservationAction", () => {
  const FROZEN_INSTANT = new Date("2026-05-04T02:00:00.000Z");
  const FAR_FUTURE = "2026-12-31";

  function buildManualFormData(extra: Record<string, string> = {}): FormData {
    const formData = new FormData();
    const fields = {
      name: "Cliente WhatsApp",
      email: "cliente.whatsapp@example.com",
      phone: "+57 300 123 4567",
      reservationDate: FAR_FUTURE,
      reservationTime: "21:30",
      area: "Terraza",
      partySize: "5",
      source: "whatsapp",
      status: RESERVATION_STATUS.PENDING,
      notes: "Pidió mesa tranquila por WhatsApp",
      customerLanguage: "es",
      locationId: "location-admin-1",
      ...extra,
    };

    for (const [key, value] of Object.entries(fields)) {
      formData.set(key, value);
    }

    return formData;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_INSTANT);

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
    mocks.locationFindFirst.mockResolvedValue({ id: "location-admin-1" });
    mocks.userUpsert.mockResolvedValue({ id: "user-manual-1" });
    mocks.reservationCreate.mockResolvedValue({ id: "reservation-manual-1" });
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`redirect:${url}`);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("crea una reserva manual pendiente con origen y admin creador sin enviar emails", async () => {
    const { createManualReservationAction } = await import("@/app/actions");

    await expect(createManualReservationAction(buildManualFormData())).rejects.toThrow(
      "redirect:/admin/reservations/reservation-manual-1?ok=manual-created",
    );

    expect(mocks.userUpsert).toHaveBeenCalledWith({
      where: { email: "cliente.whatsapp@example.com" },
      update: { name: "Cliente WhatsApp", phone: "573001234567" },
      create: { email: "cliente.whatsapp@example.com", name: "Cliente WhatsApp", phone: "573001234567" },
    });
    expect(mocks.reservationCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-manual-1",
        locationId: "location-admin-1",
        reservationDate: new Date(`${FAR_FUTURE}T00:00:00.000Z`),
        reservationTime: "21:30",
        area: "Terraza",
        partySize: 5,
        notes: "Pidió mesa tranquila por WhatsApp",
        status: RESERVATION_STATUS.PENDING,
        customerLanguage: "es",
        source: "whatsapp",
        createdByAdminId: "admin-1",
      },
      select: { id: true },
    });
    expect(mocks.sendReservationConfirmationEmail).not.toHaveBeenCalled();
    expect(mocks.recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      event: "RESERVATION_MANUAL_CREATED",
      resourceId: "reservation-manual-1",
      metadata: { source: "whatsapp", status: RESERVATION_STATUS.PENDING },
    }));
  });

  it("permite crearla confirmada desde admin sin disparar email automático", async () => {
    const { createManualReservationAction } = await import("@/app/actions");

    await expect(createManualReservationAction(buildManualFormData({
      source: "instagram",
      status: RESERVATION_STATUS.CONFIRMED,
      notes: "Confirmada por DM antes de cargarla",
    }))).rejects.toThrow("redirect:/admin/reservations/reservation-manual-1?ok=manual-created");

    const createArgs = mocks.reservationCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(createArgs.data.status).toBe(RESERVATION_STATUS.CONFIRMED);
    expect(createArgs.data.source).toBe("instagram");
    expect(createArgs.data.confirmedAt).toBeInstanceOf(Date);
    expect(createArgs.data.confirmedById).toBe("admin-1");
    expect(mocks.sendReservationConfirmationEmail).not.toHaveBeenCalled();
  });

  it("rechaza orígenes no permitidos y no crea la reserva", async () => {
    const { createManualReservationAction } = await import("@/app/actions");

    await expect(createManualReservationAction(buildManualFormData({ source: "telegram" }))).rejects.toThrow(
      "redirect:/admin/reservations/new?error=invalid-data",
    );

    expect(mocks.userUpsert).not.toHaveBeenCalled();
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
  });

  it("rechaza una sede manual inválida o inactiva", async () => {
    mocks.locationFindFirst.mockResolvedValueOnce(null);
    const { createManualReservationAction } = await import("@/app/actions");

    await expect(createManualReservationAction(buildManualFormData({ locationId: "missing" }))).rejects.toThrow(
      "redirect:/admin/reservations/new?error=invalid-data",
    );

    expect(mocks.userUpsert).not.toHaveBeenCalled();
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
  });
});

describe("uploadZonePhotoAction", () => {
  const mockAdmin = {
    adminId: "admin-super-1",
    name: "Super Admin",
    email: "super@tauras.test",
    role: "SUPER_ADMIN",
  };

  function buildPhotoFormData(extra: Record<string, string> = {}): FormData {
    const formData = new FormData();
    const fields = { locationId: "loc-1", areaValue: "Terraza", ...extra };
    for (const [key, value] of Object.entries(fields)) {
      formData.set(key, value);
    }
    if (!extra.file) {
      const blob = new Blob(["fake-image-bytes"], { type: "image/jpeg" });
      const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
      formData.set("file", file);
    }
    return formData;
  }

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.headers.mockResolvedValue(new Headers({ origin: "https://tauras.test" }));
    mocks.requireSuperAdmin.mockResolvedValue(mockAdmin);
    mocks.isValidAdminMutationOrigin.mockReturnValue(true);
    mocks.getRequestSecurityContext.mockReturnValue({ ip: "127.0.0.1", userAgent: "vitest" });
    mocks.recordAuditLog.mockResolvedValue(undefined);
    mocks.toAreaSlug.mockImplementation((val: string) => val.toLowerCase().replace(/\s+/g, "-"));
    mocks.saveZonePhoto.mockResolvedValue("/uploads/zones/tauras-default/terraza.jpg");
    mocks.locationFindUnique.mockResolvedValue({ id: "loc-1", slug: "tauras-default" });
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`redirect:${url}`);
    });
  });

  it("uploads a valid photo for a new zone via upsert", async () => {
    mocks.validateImageFile.mockResolvedValue({ ok: true, buffer: Buffer.from([1, 2, 3]), ext: ".jpg", mime: "image/jpeg" });
    mocks.zoneFindUnique.mockResolvedValue(null);
    mocks.zoneUpsert.mockResolvedValue({ id: "zone-1" });

    const { uploadZonePhotoAction } = await import("@/app/actions");
    await expect(uploadZonePhotoAction(buildPhotoFormData())).rejects.toThrow(
      "redirect:/admin/settings/photos?ok=photo-uploaded",
    );

    expect(mocks.validateImageFile).toHaveBeenCalledOnce();
    expect(mocks.saveZonePhoto).toHaveBeenCalledWith(
      "public", "tauras-default", "terraza", expect.any(Buffer), ".jpg",
    );
    expect(mocks.zoneUpsert).toHaveBeenCalledWith({
      where: { locationId_areaValue: { locationId: "loc-1", areaValue: "Terraza" } },
      update: { imagePath: "/uploads/zones/tauras-default/terraza.jpg" },
      create: { locationId: "loc-1", areaValue: "Terraza", imagePath: "/uploads/zones/tauras-default/terraza.jpg" },
    });
    expect(mocks.recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      event: "PHOTO_UPLOADED",
      resourceType: "ZONE",
      resourceId: "loc-1:Terraza",
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/settings/photos");
  });

  it("replaces an existing zone photo by deleting the old file before upsert", async () => {
    mocks.validateImageFile.mockResolvedValue({ ok: true, buffer: Buffer.from([1, 2, 3]), ext: ".jpg", mime: "image/jpeg" });
    mocks.zoneFindUnique.mockResolvedValue({ id: "zone-1", imagePath: "/uploads/zones/tauras-default/terraza-old.jpg" });
    mocks.zoneUpsert.mockResolvedValue({ id: "zone-1" });

    const { uploadZonePhotoAction } = await import("@/app/actions");
    await expect(uploadZonePhotoAction(buildPhotoFormData())).rejects.toThrow(
      "redirect:/admin/settings/photos?ok=photo-uploaded",
    );

    expect(mocks.deleteZonePhoto).toHaveBeenCalledWith("public", "/uploads/zones/tauras-default/terraza-old.jpg");
    expect(mocks.saveZonePhoto).toHaveBeenCalledOnce();
  });

  it("rejects upload when no file is provided", async () => {
    const { uploadZonePhotoAction } = await import("@/app/actions");
    const formData = buildPhotoFormData({ file: "" });
    formData.delete("file");

    await expect(uploadZonePhotoAction(formData)).rejects.toThrow(
      "redirect:/admin/settings/photos?error=invalid-data",
    );

    expect(mocks.saveZonePhoto).not.toHaveBeenCalled();
    expect(mocks.zoneUpsert).not.toHaveBeenCalled();
  });

  it("rejects upload when validation fails", async () => {
    mocks.validateImageFile.mockResolvedValue({ ok: false, error: "photo-too-large" });

    const { uploadZonePhotoAction } = await import("@/app/actions");
    await expect(uploadZonePhotoAction(buildPhotoFormData())).rejects.toThrow(
      "redirect:/admin/settings/photos?error=photo-too-large",
    );

    expect(mocks.saveZonePhoto).not.toHaveBeenCalled();
    expect(mocks.zoneUpsert).not.toHaveBeenCalled();
  });

  it("rejects upload when area is not allowed for the location", async () => {
    mocks.validateImageFile.mockResolvedValue({ ok: true, buffer: Buffer.from([1]), ext: ".jpg", mime: "image/jpeg" });

    const { uploadZonePhotoAction } = await import("@/app/actions");
    await expect(uploadZonePhotoAction(buildPhotoFormData({ areaValue: "Azotea" }))).rejects.toThrow(
      "redirect:/admin/settings/photos?error=invalid-data",
    );

    expect(mocks.saveZonePhoto).not.toHaveBeenCalled();
    expect(mocks.zoneUpsert).not.toHaveBeenCalled();
  });

  it("rejects upload when no locationId or areaValue is missing", async () => {
    const { uploadZonePhotoAction } = await import("@/app/actions");

    await expect(uploadZonePhotoAction(buildPhotoFormData({ locationId: "" }))).rejects.toThrow(
      "redirect:/admin/settings/photos?error=invalid-data",
    );

    await expect(uploadZonePhotoAction(buildPhotoFormData({ areaValue: "" }))).rejects.toThrow(
      "redirect:/admin/settings/photos?error=invalid-data",
    );

    expect(mocks.validateImageFile).not.toHaveBeenCalled();
  });

  it("rejects upload when location does not exist", async () => {
    mocks.validateImageFile.mockResolvedValue({ ok: true, buffer: Buffer.from([1]), ext: ".jpg", mime: "image/jpeg" });
    mocks.locationFindUnique.mockResolvedValue(null);

    const { uploadZonePhotoAction } = await import("@/app/actions");
    await expect(uploadZonePhotoAction(buildPhotoFormData())).rejects.toThrow(
      "redirect:/admin/settings/photos?error=invalid-data",
    );

    expect(mocks.saveZonePhoto).not.toHaveBeenCalled();
    expect(mocks.zoneUpsert).not.toHaveBeenCalled();
  });
});

describe("deleteZonePhotoAction", () => {
  const mockAdmin = {
    adminId: "admin-super-1",
    name: "Super Admin",
    email: "super@tauras.test",
    role: "SUPER_ADMIN",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.headers.mockResolvedValue(new Headers({ origin: "https://tauras.test" }));
    mocks.requireSuperAdmin.mockResolvedValue(mockAdmin);
    mocks.isValidAdminMutationOrigin.mockReturnValue(true);
    mocks.getRequestSecurityContext.mockReturnValue({ ip: "127.0.0.1", userAgent: "vitest" });
    mocks.recordAuditLog.mockResolvedValue(undefined);
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`redirect:${url}`);
    });
  });

  it("deletes a zone photo and sets imagePath to null", async () => {
    mocks.zoneFindUnique.mockResolvedValue({
      id: "zone-1",
      imagePath: "/uploads/zones/tauras-default/terraza.jpg",
      areaValue: "Terraza",
      locationId: "loc-1",
    });
    mocks.zoneUpdate.mockResolvedValue({ id: "zone-1" });

    const formData = new FormData();
    formData.set("zoneId", "zone-1");

    const { deleteZonePhotoAction } = await import("@/app/actions");
    await expect(deleteZonePhotoAction(formData)).rejects.toThrow(
      "redirect:/admin/settings/photos?ok=photo-deleted",
    );

    expect(mocks.deleteZonePhoto).toHaveBeenCalledWith("public", "/uploads/zones/tauras-default/terraza.jpg");
    expect(mocks.zoneUpdate).toHaveBeenCalledWith({
      where: { id: "zone-1" },
      data: { imagePath: null },
    });
    expect(mocks.recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      event: "PHOTO_DELETED",
      resourceType: "ZONE",
      resourceId: "loc-1:Terraza",
    }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/settings/photos");
  });

  it("rejects delete when zone has no photo", async () => {
    mocks.zoneFindUnique.mockResolvedValue({
      id: "zone-1",
      imagePath: null,
      areaValue: "Terraza",
      locationId: "loc-1",
    });

    const formData = new FormData();
    formData.set("zoneId", "zone-1");

    const { deleteZonePhotoAction } = await import("@/app/actions");
    await expect(deleteZonePhotoAction(formData)).rejects.toThrow(
      "redirect:/admin/settings/photos?error=not-found",
    );

    expect(mocks.deleteZonePhoto).not.toHaveBeenCalled();
    expect(mocks.zoneUpdate).not.toHaveBeenCalled();
  });

  it("rejects delete when zoneId is missing", async () => {
    const formData = new FormData();
    formData.set("zoneId", "");

    const { deleteZonePhotoAction } = await import("@/app/actions");
    await expect(deleteZonePhotoAction(formData)).rejects.toThrow(
      "redirect:/admin/settings/photos?error=invalid-data",
    );

    expect(mocks.zoneFindUnique).not.toHaveBeenCalled();
    expect(mocks.deleteZonePhoto).not.toHaveBeenCalled();
  });

  it("rejects delete when zone does not exist", async () => {
    mocks.zoneFindUnique.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("zoneId", "zone-missing");

    const { deleteZonePhotoAction } = await import("@/app/actions");
    await expect(deleteZonePhotoAction(formData)).rejects.toThrow(
      "redirect:/admin/settings/photos?error=not-found",
    );

    expect(mocks.deleteZonePhoto).not.toHaveBeenCalled();
    expect(mocks.zoneUpdate).not.toHaveBeenCalled();
  });
});
