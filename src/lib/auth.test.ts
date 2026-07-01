import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_ROLE } from "@/lib/constants";

// Exercises the real authorization guards in auth.ts against the real (pure)
// permission model. Only the I/O edges are mocked — cookies, JWT verification,
// the database read, and redirect — so the role -> access decision is genuinely
// under test, not stubbed away.
const mocks = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  redirect: vi.fn(),
  jwtVerify: vi.fn(),
  adminFindUnique: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookieGet }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mocks.redirect(url);
    // Next's real redirect throws to halt execution; mirror that so code after
    // a denied guard never runs.
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("jose", () => ({
  SignJWT: class {
    setProtectedHeader() { return this; }
    setSubject() { return this; }
    setIssuedAt() { return this; }
    setExpirationTime() { return this; }
    async sign() { return "signed-token"; }
  },
  jwtVerify: mocks.jwtVerify,
}));
vi.mock("bcryptjs", () => ({
  hash: vi.fn(async () => "hashed"),
  compare: vi.fn(async () => true),
}));
vi.mock("@/lib/db", () => ({
  prisma: { admin: { findUnique: mocks.adminFindUnique } },
}));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({ SESSION_SECRET: "test-secret" }),
}));

function seedSession(role: string): void {
  mocks.cookieGet.mockReturnValue({ value: "token" });
  mocks.jwtVerify.mockResolvedValue({ payload: { sub: "admin-1", sv: 0 } });
  mocks.adminFindUnique.mockResolvedValue({
    email: "admin@tauras.test",
    role,
    isActive: true,
    name: "Admin Tauras",
    sessionVersion: 0,
  });
}

describe("requireAdministrationAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admits ADMIN", async () => {
    seedSession(ADMIN_ROLE.ADMIN);
    const { requireAdministrationAccess } = await import("@/lib/auth");
    const session = await requireAdministrationAccess();
    expect(session.role).toBe(ADMIN_ROLE.ADMIN);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("admits SUPER_ADMIN", async () => {
    seedSession(ADMIN_ROLE.SUPER_ADMIN);
    const { requireAdministrationAccess } = await import("@/lib/auth");
    const session = await requireAdministrationAccess();
    expect(session.role).toBe(ADMIN_ROLE.SUPER_ADMIN);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects a RESERVATION_OPERATOR away from administration", async () => {
    seedSession(ADMIN_ROLE.RESERVATION_OPERATOR);
    const { requireAdministrationAccess } = await import("@/lib/auth");
    await expect(requireAdministrationAccess()).rejects.toThrow(/redirect:\/admin\?error=/);
    expect(mocks.redirect).toHaveBeenCalledWith(expect.stringContaining("/admin?error="));
  });
});

describe("session revocation via sessionVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a validly-signed token whose sessionVersion is stale", async () => {
    // Token was minted at version 0, but the admin's password was changed since
    // (DB is now at version 1). The JWT still verifies, yet the session is dead.
    mocks.cookieGet.mockReturnValue({ value: "token" });
    mocks.jwtVerify.mockResolvedValue({ payload: { sub: "admin-1", sv: 0 } });
    mocks.adminFindUnique.mockResolvedValue({
      email: "admin@tauras.test",
      role: ADMIN_ROLE.ADMIN,
      isActive: true,
      name: "Admin Tauras",
      sessionVersion: 1,
    });

    const { getCurrentAdmin, requireAdmin } = await import("@/lib/auth");
    expect(await getCurrentAdmin()).toBeNull();
    await expect(requireAdmin()).rejects.toThrow("redirect:/admin/login");
  });

  it("admits a token whose sessionVersion still matches the admin", async () => {
    mocks.cookieGet.mockReturnValue({ value: "token" });
    mocks.jwtVerify.mockResolvedValue({ payload: { sub: "admin-1", sv: 3 } });
    mocks.adminFindUnique.mockResolvedValue({
      email: "admin@tauras.test",
      role: ADMIN_ROLE.ADMIN,
      isActive: true,
      name: "Admin Tauras",
      sessionVersion: 3,
    });

    const { getCurrentAdmin } = await import("@/lib/auth");
    const session = await getCurrentAdmin();
    expect(session?.adminId).toBe("admin-1");
  });

  it("treats a legacy token without sv as version 0 (deploy-safe)", async () => {
    // Pre-revocation tokens carry no `sv`; they stay valid against a freshly
    // backfilled admin at version 0, so a deploy does not force a mass logout.
    mocks.cookieGet.mockReturnValue({ value: "token" });
    mocks.jwtVerify.mockResolvedValue({ payload: { sub: "admin-1" } });
    mocks.adminFindUnique.mockResolvedValue({
      email: "admin@tauras.test",
      role: ADMIN_ROLE.ADMIN,
      isActive: true,
      name: "Admin Tauras",
      sessionVersion: 0,
    });

    const { getCurrentAdmin } = await import("@/lib/auth");
    const session = await getCurrentAdmin();
    expect(session?.adminId).toBe("admin-1");
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admits a RESERVATION_OPERATOR to reservation areas", async () => {
    seedSession(ADMIN_ROLE.RESERVATION_OPERATOR);
    const { requireAdmin } = await import("@/lib/auth");
    const session = await requireAdmin();
    expect(session.role).toBe(ADMIN_ROLE.RESERVATION_OPERATOR);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects to login when there is no valid session", async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    const { requireAdmin } = await import("@/lib/auth");
    await expect(requireAdmin()).rejects.toThrow("redirect:/admin/login");
  });
});

describe("requireSuperAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admits SUPER_ADMIN", async () => {
    seedSession(ADMIN_ROLE.SUPER_ADMIN);
    const { requireSuperAdmin } = await import("@/lib/auth");
    const session = await requireSuperAdmin();
    expect(session.role).toBe(ADMIN_ROLE.SUPER_ADMIN);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects a RESERVATION_OPERATOR", async () => {
    seedSession(ADMIN_ROLE.RESERVATION_OPERATOR);
    const { requireSuperAdmin } = await import("@/lib/auth");
    await expect(requireSuperAdmin()).rejects.toThrow(/redirect:\/admin\?error=/);
  });

  it("redirects a plain ADMIN", async () => {
    seedSession(ADMIN_ROLE.ADMIN);
    const { requireSuperAdmin } = await import("@/lib/auth");
    await expect(requireSuperAdmin()).rejects.toThrow(/redirect:\/admin\?error=/);
  });
});
