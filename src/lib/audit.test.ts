import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const auditLog = { create: vi.fn() };

vi.mock("@/lib/db", () => ({
  prisma: { auditLog },
}));

const { AUDIT_EVENT, recordAuditLog } = await import("@/lib/audit");

describe("recordAuditLog", () => {
  it("persiste el evento con actor y contexto de request", async () => {
    auditLog.create.mockResolvedValue({});

    await recordAuditLog({
      event: AUDIT_EVENT.RESERVATIONS_EXPORTED,
      actor: { adminId: "admin_1", email: "admin@tauras.example", role: "SUPER_ADMIN", name: "Admin" },
      request: { ipAddress: "203.0.113.10", userAgent: "Vitest" },
      resourceType: "RESERVATION_EXPORT",
      metadata: { format: "xlsx", count: 3 },
    });

    expect(auditLog.create).toHaveBeenCalledWith({
      data: {
        event: "RESERVATIONS_EXPORTED",
        actorAdminId: "admin_1",
        actorEmail: "admin@tauras.example",
        actorRole: "SUPER_ADMIN",
        resourceType: "RESERVATION_EXPORT",
        resourceId: undefined,
        outcome: "SUCCESS",
        ipAddress: "203.0.113.10",
        userAgent: "Vitest",
        metadata: { format: "xlsx", count: 3 },
      },
    });
  });

  it("no rompe el flujo principal si Prisma falla", async () => {
    const error = new Error("db down");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    auditLog.create.mockRejectedValue(error);

    await expect(recordAuditLog({
      event: AUDIT_EVENT.ADMIN_CREATED,
      actor: { adminId: "admin_1", email: "admin@tauras.example", role: "SUPER_ADMIN", name: "Admin" },
      request: { ipAddress: null, userAgent: null },
      resourceType: "ADMIN",
      resourceId: "admin_2",
    })).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith("Failed to record audit log", error);
    consoleError.mockRestore();
  });
});
