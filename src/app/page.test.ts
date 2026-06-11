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
  getZoneImages: vi.fn(async () => ({})),
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
    expect(html).toContain("Choose your language");
    expect(html).toContain('src="/flags/us.svg"');
    expect(html).toContain('src="/flags/es.svg"');
    expect(html).toContain('alt=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('aria-current="true"');
    expect(html).not.toContain('name="lang"');
    expect(html).not.toContain('href="/?lang=en"');
  });

  it("renders Spanish copy from lang=es while keeping canonical option values", async () => {
    const html = await renderHomePage({ lang: "es" });

    expect(html).toContain("Reserva tu mesa con tranquilidad");
    expect(html).toContain("Elige tu idioma");
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

    expect(html).toContain(">Steakhouse<");
    expect(html).toContain("Bar &amp; Lounge");
    expect(html).toContain("Tex Mex");
    expect(html).not.toContain("TAURAS Steakhouse");
    expect(html).not.toContain("TAURAS Bar &amp; Lounge");
    expect(html).toContain('value="tauras-default"');
    expect(html).toContain('value="tauras-bar-lounge"');
    expect(html).toContain('value="tauras-tex-mex"');
  });
});

describe("HomePage marketing venue + UTM links", () => {
  // Helper: locate the radio input for a given internal slug and assert whether
  // it is rendered as checked. renderToStaticMarkup emits `checked=""`.
  function radioIsChecked(html: string, slug: string): boolean {
    const marker = `value="${slug}"`;
    const idx = html.indexOf(marker);
    if (idx === -1) return false;
    // The `checked` attribute (when present) precedes value within the same input tag.
    const tagStart = html.lastIndexOf("<input", idx);
    const tag = html.slice(tagStart, idx + marker.length);
    return tag.includes("checked");
  }

  it("preselects Tex Mex and renders English from ?venue=tex-mex&lang=en", async () => {
    const html = await renderHomePage({ venue: "tex-mex", lang: "en" });

    expect(html).toContain("Book your table with confidence");
    expect(radioIsChecked(html, "tauras-tex-mex")).toBe(true);
    expect(radioIsChecked(html, "tauras-default")).toBe(false);
    // Tex Mex areas drive the SSR options (Dining Room is Tex-Mex-only in English).
    expect(html).toContain("Dining Room");
  });

  it("preselects Bar & Lounge and renders Spanish from ?venue=bar-lounge&lang=es", async () => {
    const html = await renderHomePage({ venue: "bar-lounge", lang: "es" });

    expect(html).toContain("Reserva tu mesa con tranquilidad");
    expect(radioIsChecked(html, "tauras-bar-lounge")).toBe(true);
  });

  it("preserves the venue in the language-switch hrefs", async () => {
    const html = await renderHomePage({ venue: "tex-mex", lang: "es" });

    expect(html).toContain('href="/?lang=es&amp;venue=tex-mex"');
    expect(html).toContain('href="/?venue=tex-mex"');
  });

  it("preserves venue + UTM in the language-switch hrefs, dropping arbitrary params", async () => {
    const html = await renderHomePage({
      venue: "tex-mex",
      lang: "en",
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "texmex_en",
      foo: "bar",
    });

    // EN link (current language) omits lang but carries venue + UTM.
    expect(html).toContain(
      'href="/?venue=tex-mex&amp;utm_source=google&amp;utm_medium=cpc&amp;utm_campaign=texmex_en"',
    );
    // ES link carries lang + venue + UTM so attribution survives a switch.
    expect(html).toContain(
      'href="/?lang=es&amp;venue=tex-mex&amp;utm_source=google&amp;utm_medium=cpc&amp;utm_campaign=texmex_en"',
    );
    // Arbitrary / lifecycle params are never carried into the language hrefs.
    expect(html).not.toContain("foo=bar");
  });

  it("does not preserve UTM when the values are empty or absent", async () => {
    const html = await renderHomePage({ venue: "tex-mex", lang: "es", utm_source: "   " });

    // Blank UTM is dropped: the href stays venue-only.
    expect(html).toContain('href="/?lang=es&amp;venue=tex-mex"');
    expect(html).not.toContain("utm_source");
  });

  it("emits sanitized hidden inputs for landingVenue and UTM params", async () => {
    const html = await renderHomePage({
      venue: "tex-mex",
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "texmex_es",
    });

    expect(html).toContain('name="landingVenue"');
    expect(html).toContain('value="tex-mex"');
    expect(html).toContain('name="utmSource"');
    expect(html).toContain('value="google"');
    expect(html).toContain('name="utmCampaign"');
    expect(html).toContain('value="texmex_es"');
    // No UTM term/content were provided, so those hidden inputs are absent.
    expect(html).not.toContain('name="utmTerm"');
    expect(html).not.toContain('name="utmContent"');
  });

  it("ignores an invalid venue without breaking the page or preselecting", async () => {
    const html = await renderHomePage({ venue: "foo", lang: "es" });

    expect(html).toContain("Reserva tu mesa con tranquilidad");
    expect(html).not.toContain('name="landingVenue"');
    expect(html).not.toContain('href="/?lang=es&amp;venue=');
    expect(radioIsChecked(html, "tauras-default")).toBe(false);
    expect(radioIsChecked(html, "tauras-tex-mex")).toBe(false);
  });
});
