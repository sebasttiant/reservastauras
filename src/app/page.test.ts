import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";

vi.mock("@/app/actions", () => ({
  createReservationAction: vi.fn(),
}));

vi.mock("@/app/reservation-success-reset", () => ({
  ReservationSuccessReset: () => null,
}));

async function renderHomePage(searchParams: Record<string, string | undefined> = {}): Promise<string> {
  const page = await HomePage({ searchParams: Promise.resolve(searchParams) });
  return renderToStaticMarkup(page);
}

describe("HomePage public language rendering", () => {
  it("renders English by default and posts sanitized customerLanguage=en", async () => {
    const html = await renderHomePage();

    expect(html).toContain("Book your table with confidence");
    expect(html).toContain('name="customerLanguage"');
    expect(html).toContain('value="en"');
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
});
