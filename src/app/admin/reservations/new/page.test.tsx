import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_ROLE } from "@/lib/constants";

// A RESERVATION_OPERATOR may load the manual "Nueva reserva" page. The guard is
// requireAdmin, so the page rendering for an operator session proves access.
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getActiveReservationLocations: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) =>
      React.createElement("a", { href, ...rest }, children),
  };
});
vi.mock("@/app/actions", () => ({ createManualReservationAction: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/reservations/locations", () => ({
  getActiveReservationLocations: mocks.getActiveReservationLocations,
}));

async function renderNewPage(role: string): Promise<string> {
  mocks.requireAdmin.mockResolvedValue({ adminId: "op-1", name: "Operador", email: "op@tauras.test", role });
  const { default: Page } = await import("@/app/admin/reservations/new/page");
  const page = await Page({ searchParams: Promise.resolve({}) });
  return renderToStaticMarkup(page);
}

describe("NewReservationPage access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveReservationLocations.mockResolvedValue([
      { id: "loc-1", reservationLabel: "TAURAS Steakhouse" },
    ]);
  });

  it("renders the manual reservation form for a RESERVATION_OPERATOR", async () => {
    const html = await renderNewPage(ADMIN_ROLE.RESERVATION_OPERATOR);

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(html).toContain("Nueva reserva");
    expect(html).toContain('name="partySize"');
    expect(html).toContain('name="locationId"');
    expect(html).toContain("TAURAS Steakhouse");
  });
});
