import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PublicReservationPage } from "@/app/public-reservation-page";

vi.mock("@/app/actions", () => ({
  createReservationAction: vi.fn(),
}));

vi.mock("@/app/reservation-success-reset", () => ({
  ReservationSuccessReset: () => null,
}));

const singleLocation = {
  id: "location-1",
  slug: "tauras-default",
  name: "TAURAS Steakhouse",
  reservationLabel: "Main dining room",
  logoPath: null,
  heroImagePath: null,
};

const threeLocations = [
  singleLocation,
  {
    id: "location-2",
    slug: "tauras-bar-lounge",
    name: "TAURAS Bar & Lounge",
    reservationLabel: "TAURAS Bar & Lounge — El Poblado (Piso 2)",
    logoPath: null,
    heroImagePath: null,
  },
  {
    id: "location-3",
    slug: "tauras-tex-mex",
    name: "TAURAS Tex Mex",
    reservationLabel: "TAURAS Tex Mex — Las Palmas, Mall Indiana",
    logoPath: null,
    heroImagePath: null,
  },
];

const locationsMock = vi.hoisted(() => ({
  getActiveReservationLocations: vi.fn(async () => threeLocations),
}));

vi.mock("@/lib/reservations/locations", () => locationsMock);

async function renderHomePage(searchParams: Record<string, string | undefined> = {}): Promise<string> {
  const page = await PublicReservationPage({ searchParams });
  return renderToStaticMarkup(page);
}

describe("HomePage public language rendering", () => {
  it("renders English by default and posts sanitized customerLanguage=en", async () => {
    const html = await renderHomePage();

    expect(html).toContain("Book your table with confidence");
    expect(html).toContain('name="customerLanguage"');
    expect(html).toContain('value="en"');
    expect(html).toContain('name="locationSlug"');
    expect(html).toContain('value="tauras-default"');
    expect(html).toContain("required");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/?lang=es"');
    expect(html).not.toContain('name="lang"');
    expect(html).not.toContain('href="/?lang=en"');
  });

  it("renders Spanish copy from lang=es while keeping canonical option values", async () => {
    const html = await renderHomePage({ lang: "es" });

    expect(html).toContain("Reserva tu mesa con tranquilidad");
    expect(html).toContain('href="/?lang=es"');
    expect(html).toContain('name="customerLanguage"');
    expect(html).toContain('value="es"');
    expect(html).toContain('name="lang"');
    expect(html).toContain('<option value="Cumpleaños">Cumpleaños</option>');
    expect(html).toContain('<option value="Estados Unidos (+1)">Estados Unidos (+1)</option>');
  });

  it("renders English copy from lang=en while keeping canonical option values", async () => {
    const html = await renderHomePage({ lang: "en" });

    expect(html).toContain("Book your table with confidence");
    expect(html).toContain('href="/"');
    expect(html).toContain('name="customerLanguage"');
    expect(html).toContain('value="en"');
    expect(html).not.toContain('name="lang"');
    expect(html).toContain('<option value="Cumpleaños">Birthday</option>');
    expect(html).toContain('<option value="Estados Unidos (+1)">Estados Unidos (+1)</option>');
  });

  it("falls back visually to English for unsupported lang query values", async () => {
    const html = await renderHomePage({ lang: "foo" });

    expect(html).toContain("Book your table with confidence");
    expect(html).toContain('name="customerLanguage"');
    expect(html).toContain('value="en"');
    expect(html).not.toContain('name="lang"');
    expect(html).not.toContain('value="foo"');
  });

  it("does not render a submit-capable form when no active locations exist", async () => {
    locationsMock.getActiveReservationLocations.mockResolvedValueOnce([]);

    const html = await renderHomePage();

    expect(html).toContain("Online reservations are currently unavailable");
    expect(html).not.toContain('name="locationSlug"');
    expect(html).not.toContain("Request reservation");
  });

  it("renders zone preview with fallback for the selected area", async () => {
    const html = await renderHomePage();

    expect(html).toContain("zone-preview");
    expect(html).toContain("Photo of Any available table coming soon");
    expect(html).not.toContain("location-preview");
    expect(html).not.toContain("Location preview coming soon");
  });

  it("renders all 3 sedes when active locations are provided", async () => {
    const html = await renderHomePage();

    expect(html).toContain("TAURAS Steakhouse");
    expect(html).toContain("TAURAS Bar &amp; Lounge");
    expect(html).toContain("TAURAS Tex Mex");
    expect(html).toContain('value="tauras-default"');
    expect(html).toContain('value="tauras-bar-lounge"');
    expect(html).toContain('value="tauras-tex-mex"');
  });
});
