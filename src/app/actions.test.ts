import { beforeEach, describe, expect, it, vi } from "vitest";
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
  transaction: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
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
  },
  recordAuditLog: mocks.recordAuditLog,
}));

vi.mock("@/lib/email", () => ({
  sendReservationCancellationEmail: vi.fn(),
  sendReservationConfirmationEmail: mocks.sendReservationConfirmationEmail,
  sendReservationRejectionEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
    reservation: {
      update: vi.fn(),
    },
    user: {
      upsert: vi.fn(),
    },
    admin: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
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
});
