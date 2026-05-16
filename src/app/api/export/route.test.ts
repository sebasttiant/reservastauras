import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSuperAdmin: vi.fn(),
  reservationFindMany: vi.fn(),
  recordAuditLog: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth", () => ({
  requireSuperAdmin: mocks.requireSuperAdmin,
}));

vi.mock("@/lib/db", () => ({
  prisma: { reservation: { findMany: mocks.reservationFindMany } },
}));

vi.mock("@/lib/audit", () => ({
  AUDIT_EVENT: { RESERVATIONS_EXPORTED: "RESERVATIONS_EXPORTED" },
  recordAuditLog: mocks.recordAuditLog,
}));

vi.mock("@/lib/security/request", () => ({
  getRequestSecurityContext: () => ({ ip: "127.0.0.1", userAgent: "test" }),
}));

const ADMIN = {
  adminId: "admin-1",
  email: "admin@tauras.test",
  role: "SUPER_ADMIN" as const,
  name: "Admin",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSuperAdmin.mockResolvedValue(ADMIN);
  mocks.reservationFindMany.mockResolvedValue([]);
  mocks.recordAuditLog.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/export — permission gate", () => {
  it("propagates the redirect from requireSuperAdmin and never queries the DB", async () => {
    // En Next.js, `redirect()` lanza un error opaco; replicamos esa semántica
    // verificando que la route no continúa cuando requireSuperAdmin rechaza.
    mocks.requireSuperAdmin.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    const { GET } = await import("@/app/api/export/route");
    await expect(GET(new Request("http://localhost/api/export"))).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.reservationFindMany).not.toHaveBeenCalled();
    expect(mocks.recordAuditLog).not.toHaveBeenCalled();
  });
});

describe("GET /api/export — format validation", () => {
  it("returns 400 with a clear message when format is invalid", async () => {
    const { GET } = await import("@/app/api/export/route");
    const res = await GET(new Request("http://localhost/api/export?format=csv"));
    expect(res.status).toBe(400);
    expect(mocks.reservationFindMany).not.toHaveBeenCalled();
  });

  it("accepts json/xlsx/pdf", async () => {
    const { GET } = await import("@/app/api/export/route");

    const json = await GET(new Request("http://localhost/api/export?format=json"));
    expect(json.status).toBe(200);
    expect(json.headers.get("Content-Disposition")).toContain("reservas.json");

    mocks.reservationFindMany.mockResolvedValueOnce([]);
    const xlsx = await GET(new Request("http://localhost/api/export?format=xlsx"));
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers.get("Content-Type")).toContain("spreadsheetml");
  });
});

describe("GET /api/export — filter validation", () => {
  it("returns 400 on malformed date", async () => {
    const { GET } = await import("@/app/api/export/route");
    const res = await GET(new Request("http://localhost/api/export?from=2026/01/01"));
    expect(res.status).toBe(400);
    expect(mocks.reservationFindMany).not.toHaveBeenCalled();
  });

  it("returns 400 on unknown status", async () => {
    const { GET } = await import("@/app/api/export/route");
    const res = await GET(new Request("http://localhost/api/export?status=DELETED"));
    expect(res.status).toBe(400);
  });

  it("forwards status filter into prisma where", async () => {
    const { GET } = await import("@/app/api/export/route");
    const res = await GET(new Request("http://localhost/api/export?format=json&status=CONFIRMED"));
    expect(res.status).toBe(200);
    const args = mocks.reservationFindMany.mock.calls[0]?.[0];
    expect(args?.where?.status).toBe("CONFIRMED");
  });

  it("forwards `q` into a Prisma OR clause across customer/location/area fields", async () => {
    const { GET } = await import("@/app/api/export/route");
    const res = await GET(new Request("http://localhost/api/export?format=json&q=Laura"));
    expect(res.status).toBe(200);
    const args = mocks.reservationFindMany.mock.calls[0]?.[0];
    expect(args?.where?.OR).toEqual([
      { user: { name: { contains: "Laura", mode: "insensitive" } } },
      { user: { email: { contains: "Laura", mode: "insensitive" } } },
      { user: { phone: { contains: "Laura", mode: "insensitive" } } },
      { location: { name: { contains: "Laura", mode: "insensitive" } } },
      { location: { shortName: { contains: "Laura", mode: "insensitive" } } },
      { location: { reservationLabel: { contains: "Laura", mode: "insensitive" } } },
      { area: { contains: "Laura", mode: "insensitive" } },
    ]);
  });

  it("treats whitespace-only `q` as absent (no 400, no OR clause)", async () => {
    const { GET } = await import("@/app/api/export/route");
    const res = await GET(new Request("http://localhost/api/export?format=json&q=%20%20%20"));
    expect(res.status).toBe(200);
    const args = mocks.reservationFindMany.mock.calls[0]?.[0];
    expect(args?.where?.OR).toBeUndefined();
  });

  it("returns 400 when `date` is combined with `from`/`to`", async () => {
    const { GET } = await import("@/app/api/export/route");
    const res = await GET(
      new Request("http://localhost/api/export?date=2026-05-08&from=2026-05-01"),
    );
    expect(res.status).toBe(400);
    expect(mocks.reservationFindMany).not.toHaveBeenCalled();
  });

  it("forwards `date` as a closed same-day range in prisma where", async () => {
    const { GET } = await import("@/app/api/export/route");
    const res = await GET(
      new Request("http://localhost/api/export?format=json&date=2026-05-08"),
    );
    expect(res.status).toBe(200);
    const args = mocks.reservationFindMany.mock.calls[0]?.[0];
    expect(args?.where?.reservationDate?.gte?.toISOString()).toBe("2026-05-08T00:00:00.000Z");
    expect(args?.where?.reservationDate?.lte?.toISOString()).toBe("2026-05-08T23:59:59.999Z");
  });
});

describe("GET /api/export — audit metadata records q/date", () => {
  it("includes q and date in the audit metadata filters", async () => {
    const { GET } = await import("@/app/api/export/route");
    const res = await GET(
      new Request("http://localhost/api/export?format=json&q=Laura&date=2026-05-08"),
    );
    expect(res.status).toBe(200);
    expect(mocks.recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        filters: expect.objectContaining({ q: "Laura", date: "2026-05-08" }),
      }),
    }));
  });
});

describe("GET /api/export — limit", () => {
  it("returns 413 when results exceed the effective limit", async () => {
    // El handler pide limit+1 a Prisma para detectar el desborde sin un count
    // extra. Con limit=2, devolver 3 filas debe disparar 413.
    const overflow = [{ id: "1" }, { id: "2" }, { id: "3" }];
    mocks.reservationFindMany.mockResolvedValueOnce(overflow);

    const { GET } = await import("@/app/api/export/route");
    const res = await GET(new Request("http://localhost/api/export?limit=2"));
    expect(res.status).toBe(413);
    expect(mocks.recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ blocked: true, reason: "limit-exceeded" }),
    }));
    const args = mocks.reservationFindMany.mock.calls[0]?.[0];
    expect(args?.take).toBe(3);
  });
});
