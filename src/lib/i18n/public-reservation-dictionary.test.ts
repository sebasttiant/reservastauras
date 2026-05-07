import { describe, expect, it } from "vitest";
import {
  buildPublicLanguageHref,
  getPublicReservationCopy,
} from "@/lib/i18n/public-reservation-dictionary";

describe("public reservation dictionary", () => {
  it("returns Spanish copy by default/fallback and English copy for supported lang", () => {
    expect(getPublicReservationCopy("es").hero.title).toBe("Reserva tu mesa con tranquilidad");
    expect(getPublicReservationCopy("en").hero.title).toBe("Book your table with confidence");
    expect(getPublicReservationCopy("foo").hero.title).toBe("Reserva tu mesa con tranquilidad");
  });

  it("localizes visible area/reason labels while keeping canonical option values", () => {
    const englishCopy = getPublicReservationCopy("en");

    expect(englishCopy.areaOptions).toContainEqual({
      value: "Cualquier Mesa Disponible",
      label: "Any available table",
    });
    expect(englishCopy.reasonOptions).toContainEqual({
      value: "Cumpleaños",
      label: "Birthday",
    });
  });

  it("keeps country option labels and values unchanged in English", () => {
    const englishCopy = getPublicReservationCopy("en");

    expect(englishCopy.countries[0]).toEqual({
      value: "Colombia (+57)",
      label: "Colombia (+57)",
    });
    expect(englishCopy.countries).toContainEqual({
      value: "Estados Unidos (+1)",
      label: "Estados Unidos (+1)",
    });
  });

  it("builds server-renderable language hrefs and never preserves unsupported lang values", () => {
    expect(buildPublicLanguageHref("en")).toBe("/?lang=en");
    expect(buildPublicLanguageHref("es")).toBe("/?lang=es");
    expect(buildPublicLanguageHref("foo")).toBe("/?lang=es");
  });
});
