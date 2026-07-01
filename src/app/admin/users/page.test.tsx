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

async function renderUsersPage(searchParams: Record<string, string | undefined> = {}) {
  const { default: AdminUsersPage } = await import("@/app/admin/users/page");
  const page = await AdminUsersPage({ searchParams: Promise.resolve(searchParams) });
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

  it("renders an edit link per row and no inline edit form", async () => {
    const html = await renderUsersPage();

    // "Editar" is now a link to the URL-driven edit drawer, not an inline form.
    expect(html).toContain('href="/admin/users?edit=admin-2"');
    expect(html).toContain(">Editar<");
    // With no ?edit param the drawer is closed, so no edit form is rendered.
    expect(html).not.toContain(">Guardar cambios<");
    expect(html).not.toContain("<details");
  });

  it("opens the edit drawer when ?edit matches an admin", async () => {
    const html = await renderUsersPage({ edit: "admin-2" });

    expect(html).toContain("edit-drawer");
    expect(html).toContain(">Guardar cambios<");
    // The drawer targets the selected admin and preserves its active state.
    expect(html).toContain('name="adminId" value="admin-2"');
    expect(html).toContain('name="isActive" value="true"');
  });

  it("hides role and password fields when editing your own user", async () => {
    mocks.adminFindMany.mockResolvedValueOnce([
      { id: "super-1", name: "Super Admin", email: "super@tauras.test", role: "SUPER_ADMIN", isActive: true, createdAt: new Date("2026-01-01T00:00:00Z") },
    ]);

    const html = await renderUsersPage({ edit: "super-1" });

    expect(html).toContain("/admin/account");
    expect(html).not.toContain("Nueva contraseña");
  });
});
