import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSuperAdmin: vi.fn(),
  adminFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  requireSuperAdmin: mocks.requireSuperAdmin,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    admin: { findMany: mocks.adminFindMany },
  },
}));
vi.mock("@/app/actions", () => ({
  createAdminAction: vi.fn(),
  editAdminAction: vi.fn(),
  toggleAdminActiveAction: vi.fn(),
}));

const superAdmin = { adminId: "super-1", name: "Super Admin", email: "super@tauras.test", role: "SUPER_ADMIN" };

async function renderUsersPage() {
  const { default: AdminUsersPage } = await import("@/app/admin/users/page");
  const page = await AdminUsersPage({ searchParams: Promise.resolve({}) });
  return renderToStaticMarkup(page);
}

describe("AdminUsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSuperAdmin.mockResolvedValue(superAdmin);
    mocks.adminFindMany.mockResolvedValue([
      { id: "admin-2", name: "Admin Dos", email: "dos@tauras.test", role: "ADMIN", isActive: true, createdAt: new Date("2026-01-01T00:00:00Z") },
    ]);
  });

  it("labels the create button 'Crear usuario' (no longer 'Crear usuario admin')", async () => {
    const html = await renderUsersPage();

    expect(html).toContain(">Crear usuario<");
    expect(html).not.toContain("Crear usuario admin");
  });

  it("renders per-row edit controls for the super admin", async () => {
    const html = await renderUsersPage();

    expect(html).toContain(">Editar<");
    expect(html).toContain(">Guardar cambios<");
  });
});
