import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_ROLE } from "@/lib/constants";

// Proves role-based navigation: forbidden admin areas are absent from the
// rendered DOM for a RESERVATION_OPERATOR (hidden, never disabled), while the
// reservation operations (tabs, new reservation, filters) stay available.
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  reservationFindMany: vi.fn(),
  reservationGroupBy: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) =>
      React.createElement("a", { href, ...rest }, children),
  };
});
vi.mock("@/app/actions", () => ({ logoutAction: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: {
      findMany: mocks.reservationFindMany,
      groupBy: mocks.reservationGroupBy,
    },
  },
}));
vi.mock("./_components/admin-reservation-filters", async () => {
  const React = await import("react");
  return {
    AdminReservationFilters: () =>
      React.createElement("div", { "data-testid": "reservation-filters" }, "reservation-filters-stub"),
  };
});

function session(role: string) {
  return { adminId: "admin-1", name: "User", email: "user@tauras.test", role };
}

async function renderAdminPage(role: string): Promise<string> {
  mocks.requireAdmin.mockResolvedValue(session(role));
  const { default: Page } = await import("@/app/admin/page");
  const page = await Page({ searchParams: Promise.resolve({}) });
  return renderToStaticMarkup(page);
}

const PHOTOS_HREF = "/admin/settings/photos";
const EMAIL_HREF = "/admin/settings/email";
const PASSWORD_HREF = "/admin/account/password";
const USERS_HREF = "/admin/users";

describe("AdminPage navigation by role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reservationFindMany.mockResolvedValue([]);
    mocks.reservationGroupBy.mockResolvedValue([]);
  });

  it("hides every forbidden admin link for a RESERVATION_OPERATOR", async () => {
    const html = await renderAdminPage(ADMIN_ROLE.RESERVATION_OPERATOR);

    // Forbidden areas are absent entirely — no link, no disabled control.
    expect(html).not.toContain(PHOTOS_HREF);
    expect(html).not.toContain(EMAIL_HREF);
    expect(html).not.toContain(PASSWORD_HREF);
    expect(html).not.toContain(USERS_HREF);
    expect(html).not.toContain(">Fotos<");
    expect(html).not.toContain(">Correo<");
    expect(html).not.toContain(">Contraseña<");
    expect(html).not.toContain(">Usuarios<");
  });

  it("keeps reservation operations available for a RESERVATION_OPERATOR", async () => {
    const html = await renderAdminPage(ADMIN_ROLE.RESERVATION_OPERATOR);

    expect(html).toContain("/admin/reservations/new");
    expect(html).toContain("Nueva reserva");
    // Status tabs.
    for (const tab of ["Todas", "Pendiente", "Confirmada", "Rechazada", "Cancelada"]) {
      expect(html).toContain(tab);
    }
    // Search / date filter component.
    expect(html).toContain("reservation-filters-stub");
  });

  it("shows photos, email and password to a plain ADMIN but not user management", async () => {
    const html = await renderAdminPage(ADMIN_ROLE.ADMIN);

    expect(html).toContain(PHOTOS_HREF);
    expect(html).toContain(EMAIL_HREF);
    expect(html).toContain(PASSWORD_HREF);
    expect(html).not.toContain(USERS_HREF);
  });

  it("shows user management to a SUPER_ADMIN", async () => {
    const html = await renderAdminPage(ADMIN_ROLE.SUPER_ADMIN);

    expect(html).toContain(USERS_HREF);
    expect(html).toContain(PHOTOS_HREF);
    expect(html).toContain(EMAIL_HREF);
    expect(html).toContain(PASSWORD_HREF);
  });

  it("renders reservation creation timestamps in Colombia time", async () => {
    mocks.reservationFindMany.mockResolvedValueOnce([{
      id: "reservation-1",
      reservationDate: new Date("2026-08-04T00:00:00.000Z"),
      reservationTime: "20:00",
      status: "PENDING",
      area: "Patio",
      createdAt: new Date("2026-08-04T00:23:22.939Z"),
      user: { name: "Cliente", email: "cliente@tauras.test", phone: null },
      location: { shortName: "TAURAS" },
    }]);

    const html = await renderAdminPage(ADMIN_ROLE.RESERVATION_OPERATOR);

    expect(html).toMatch(/3 de agosto de 2026/i);
    expect(html).toMatch(/7:23/);
    expect(html).toMatch(/p\.\s?m\./i);
  });
});
