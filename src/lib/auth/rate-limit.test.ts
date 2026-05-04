import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const loginAttempt = {
  count: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  deleteMany: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  prisma: { loginAttempt },
}));

const { checkLoginAllowed, normalizeEmailKey, recordLoginAttempt } = await import("@/lib/auth/rate-limit");

describe("normalizeEmailKey", () => {
  it("normaliza email para usarlo como llave opaca", () => {
    expect(normalizeEmailKey("  Admin@Tauras.COM  ")).toBe("admin@tauras.com");
  });
});

describe("checkLoginAllowed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permite login cuando no hay rate limit ni lockout activo", async () => {
    loginAttempt.count.mockResolvedValue(0);
    loginAttempt.findFirst.mockResolvedValue(null);

    await expect(checkLoginAllowed({ emailKey: "admin@tauras.com", ipKey: "203.0.113.10", now: 1_000_000 })).resolves.toEqual({
      allowed: true,
    });
  });

  it("aplica rate limit por IP antes de intentar autenticar", async () => {
    loginAttempt.count.mockResolvedValueOnce(10);

    await expect(checkLoginAllowed({ emailKey: "admin@tauras.com", ipKey: "203.0.113.10", now: 1_000_000 })).resolves.toEqual({
      allowed: false,
      reason: "rate-limited",
    });
  });

  it("aplica lockout por email cuando los fallos recientes siguen dentro del cooldown", async () => {
    const now = 1_000_000;
    loginAttempt.count
      .mockResolvedValueOnce(0) // rate limit por IP
      .mockResolvedValueOnce(0) // lockout por IP
      .mockResolvedValueOnce(5); // lockout por email
    loginAttempt.findFirst.mockResolvedValueOnce({ createdAt: new Date(now - 10_000) });

    await expect(checkLoginAllowed({ emailKey: "admin@tauras.com", ipKey: "203.0.113.10", now })).resolves.toEqual({
      allowed: false,
      reason: "locked-email",
    });
  });

  it("no evalúa IP cuando no hay llave confiable", async () => {
    loginAttempt.count.mockResolvedValue(0);
    loginAttempt.findFirst.mockResolvedValue(null);

    await checkLoginAllowed({ emailKey: "admin@tauras.com", ipKey: null, now: 1_000_000 });

    expect(loginAttempt.count).toHaveBeenCalledTimes(1);
    expect(loginAttempt.count).toHaveBeenCalledWith({
      where: {
        emailKey: "admin@tauras.com",
        success: false,
        createdAt: { gte: expect.any(Date) as Date },
      },
    });
  });
});

describe("recordLoginAttempt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persiste intentos sin PII adicional", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    loginAttempt.create.mockResolvedValue({});

    await recordLoginAttempt({
      emailKey: "admin@tauras.com",
      ipKey: null,
      success: false,
      reason: "wrong-password",
    });

    expect(loginAttempt.create).toHaveBeenCalledWith({
      data: {
        emailKey: "admin@tauras.com",
        ipKey: null,
        success: false,
        reason: "wrong-password",
      },
    });
    expect(loginAttempt.deleteMany).not.toHaveBeenCalled();
  });

  it("purga oportunísticamente intentos antiguos", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    loginAttempt.create.mockResolvedValue({});
    loginAttempt.deleteMany.mockResolvedValue({ count: 0 });

    await recordLoginAttempt({
      emailKey: "admin@tauras.com",
      ipKey: "203.0.113.10",
      success: true,
      reason: null,
    });

    expect(loginAttempt.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: expect.any(Date) as Date } },
    });
  });
});
