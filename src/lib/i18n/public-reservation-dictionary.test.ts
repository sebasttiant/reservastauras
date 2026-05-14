import { describe, expect, it } from "vitest";
import {
  PUBLIC_RESERVATION_COPY,
  buildPublicLanguageHref,
  getPublicReservationCopy,
} from "@/lib/i18n/public-reservation-dictionary";

const OPTION_GROUP_KEYS = ["areaOptions", "reasonOptions", "countries"] as const;

describe("public reservation dictionary", () => {
  it("keeps option groups in shape and cardinality parity across public languages", () => {
    const spanishCopy = PUBLIC_RESERVATION_COPY.es;
    const englishCopy = PUBLIC_RESERVATION_COPY.en;

    for (const groupKey of OPTION_GROUP_KEYS) {
      const spanishOptions = spanishCopy[groupKey];
      const englishOptions = englishCopy[groupKey];

      expect(englishOptions, `${groupKey} count drifted`).toHaveLength(spanishOptions.length);

      englishOptions.forEach((englishOption, index) => {
        const spanishOption = spanishOptions[index];

        expect(Object.keys(englishOption).sort(), `${groupKey}[${index}] shape drifted`).toEqual([
          "label",
          "value",
        ]);
        expect(englishOption.value, `${groupKey}[${index}] canonical value drifted`).toBe(
          spanishOption?.value,
        );
        expect(englishOption.label, `${groupKey}[${index}] label should be non-empty`).toEqual(
          expect.any(String),
        );
        expect(englishOption.label.length, `${groupKey}[${index}] label should be non-empty`).toBeGreaterThan(0);
      });
    }
  });

  it("returns English copy by default/fallback and Spanish copy for supported lang", () => {
    expect(getPublicReservationCopy("es").hero.title).toBe("Reserva tu mesa con tranquilidad");
    expect(getPublicReservationCopy("en").hero.title).toBe("Book your table with confidence");
    expect(getPublicReservationCopy("foo").hero.title).toBe("Book your table with confidence");
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
    expect(buildPublicLanguageHref("en")).toBe("/");
    expect(buildPublicLanguageHref("es")).toBe("/?lang=es");
    expect(buildPublicLanguageHref("foo")).toBe("/");
  });
});
