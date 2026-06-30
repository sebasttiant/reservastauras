import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_ROLE, RESERVATION_STATUS } from "@/lib/constants";

// A RESERVATION_OPERATOR may open a reservation detail page and see the
// confirm / reject / cancel controls. Guard is requireAdmin; rendering for an
// operator session proves access and that the reservation actions are exposed.
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  reservationFindUnique: vi.fn(),
  reservationGroupBy: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) =>
      React.createElement("a", { href, ...rest }, children),
  };
});
vi.mock("next/navigation", () => ({
  notFound: () => {
    mocks.notFound();
    throw new Error("not-found");
  },
}));
vi.mock("@/app/actions", () => ({
  cancelReservationAction: vi.fn(),
  confirmReservationAction: vi.fn(),
  rejectReservationAction: vi.fn(),
  resendConfirmationEmailAction: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db", () => ({
  prisma: {
    reservation: {
      findUnique: mocks.reservationFindUnique,
      groupBy: mocks.reservationGroupBy,
    },
  },
}));
vi.mock("./_components/reservation-reason-picker", async () => {
  const React = await import("react");
  return {
    ReservationReasonPicker: ({ variant }: { variant: string }) =>
      React.createElement("div", { "data-testid": `reason-${variant}` }),
  };
});

function pendingReservation() {
  return {
    id: "reservation-1",
    userId: "user-1",
    locationId: "location-1",
    reservationDate: new Date("2026-09-10T00:00:00Z"),
    reservationTime: "20:00",
    area: "Patio",
    partySize: 4,
    notes: null,
    customerLanguage: "es",
    source: "web",
    status: RESERVATION_STATUS.PENDING,
    confirmedAt: null,
    confirmedById: null,
    rejectedAt: null,
    cancelledAt: null,
    rejectionReason: null,
    cancellationReason: null,
    emailError: null,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    user: { id: "user-1", name: "Cliente Tauras", email: "cliente@tauras.test", phone: null },
    location: { id: "location-1", slug: "tauras-default", name: "TAURAS", shortName: "TAURAS", reservationLabel: "TAURAS", address: null },
    createdByAdmin: null,
    confirmedBy: null,
    rejectedBy: null,
    cancelledBy: null,
  };
}

async function renderDetailPage(role: string): Promise<string> {
  mocks.requireAdmin.mockResolvedValue({ adminId: "op-1", name: "Operador", email: "op@tauras.test", role });
  const { default: Page } = await import("@/app/admin/reservations/[id]/page");
  const page = await Page({
    params: Promise.resolve({ id: "reservation-1" }),
    searchParams: Promise.resolve({}),
  });
  return renderToStaticMarkup(page);
}

describe("ReservationDetailPage access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reservationFindUnique.mockResolvedValue(pendingReservation());
    mocks.reservationGroupBy.mockResolvedValue([]);
  });

  it("renders a pending reservation with confirm/reject/cancel actions for a RESERVATION_OPERATOR", async () => {
    const html = await renderDetailPage(ADMIN_ROLE.RESERVATION_OPERATOR);

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(html).toContain("Cliente Tauras");
    expect(html).toContain("Confirmar y enviar email");
    expect(html).toContain("Rechazar reserva");
    expect(html).toContain("Cancelar reserva");
  });
});
