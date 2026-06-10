import { describe, expect, it } from "vitest";
import {
  PUBLIC_RESERVATION_COPY,
  buildPublicLanguageHref,
  getPublicReservationCopy,
  getLocationAreaOptions,
} from "@/lib/i18n/public-reservation-dictionary";
import { LOCATION_SLUGS } from "@/lib/reservations/location-config";

const OPTION_GROUP_KEYS = ["reasonOptions", "countries"] as const;

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

  it("includes localized party size guidance to prevent guest-count mistakes", () => {
    expect(getPublicReservationCopy("es").form.partySizeHelp).toContain("niños y bebés");
    expect(getPublicReservationCopy("en").form.partySizeHelp).toContain("children and babies");
  });

  it("includes localized language selector titles", () => {
    expect(getPublicReservationCopy("es").language.title).toBe("Elige tu idioma");
    expect(getPublicReservationCopy("en").language.title).toBe("Choose your language");
  });

  it("localizes visible reason labels while keeping canonical option values", () => {
    const englishCopy = getPublicReservationCopy("en");

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

  describe("per‑location area options", () => {
    it("provides Steakhouse areas with correct values in Spanish", () => {
      const options = getLocationAreaOptions(LOCATION_SLUGS.STEAKHOUSE, "es");
      expect(options).toEqual([
        { value: "Cualquier Mesa Disponible", label: "Cualquier Mesa Disponible" },
        { value: "Terraza", label: "Terraza" },
        { value: "Pasillo", label: "Pasillo" },
        { value: "Patio", label: "Patio" },
        { value: "Barra", label: "Barra" },
      ]);
    });

    it("localizes Steakhouse area labels in English", () => {
      const options = getLocationAreaOptions(LOCATION_SLUGS.STEAKHOUSE, "en");
      expect(options).toContainEqual({ value: "Cualquier Mesa Disponible", label: "Any available table" });
      expect(options).toContainEqual({ value: "Patio", label: "Patio" });
      expect(options).toContainEqual({ value: "Barra", label: "Bar" });
    });

    it("returns a single area for Bar & Lounge", () => {
      const esOptions = getLocationAreaOptions(LOCATION_SLUGS.BAR_LOUNGE, "es");
      expect(esOptions).toHaveLength(1);
      expect(esOptions[0]).toEqual({ value: "Tauras Bar & Lounge", label: "Tauras Bar & Lounge" });

      const enOptions = getLocationAreaOptions(LOCATION_SLUGS.BAR_LOUNGE, "en");
      expect(enOptions).toHaveLength(1);
      expect(enOptions[0]).toEqual({ value: "Tauras Bar & Lounge", label: "Tauras Bar & Lounge" });
    });

    it("returns Tex Mex areas with Salón (accented) and no Patio", () => {
      const options = getLocationAreaOptions(LOCATION_SLUGS.TEX_MEX, "es");
      expect(options).toEqual([
        { value: "Cualquier Mesa Disponible", label: "Cualquier Mesa Disponible" },
        { value: "Terraza", label: "Terraza" },
        { value: "Pasillo", label: "Pasillo" },
        { value: "Salón", label: "Salón" },
        { value: "Barra", label: "Barra" },
      ]);
    });

    it("falls back to Steakhouse options for unknown slugs", () => {
      const options = getLocationAreaOptions("unknown-slug", "es");
      expect(options[0]?.value).toBe("Cualquier Mesa Disponible");
      expect(options).toContainEqual({ value: "Patio", label: "Patio" });
    });

    it("preserves canonical value parity across languages per location", () => {
      for (const slug of Object.values(LOCATION_SLUGS)) {
        const esOptions = getLocationAreaOptions(slug, "es");
        const enOptions = getLocationAreaOptions(slug, "en");
        expect(enOptions).toHaveLength(esOptions.length);
        esOptions.forEach((es, i) => {
          expect(enOptions[i]?.value).toBe(es.value);
        });
      }
    });
  });

  describe("per‑location entry copy", () => {
    it("provides location descriptions and hours in Spanish", () => {
      const es = PUBLIC_RESERVATION_COPY.es.locationEntries;
      expect(es[LOCATION_SLUGS.STEAKHOUSE].description).toBe("El Poblado");
      expect(es[LOCATION_SLUGS.TEX_MEX].hours).toContain("12:00 p.m.");
    });

    it("provides location descriptions and hours in English", () => {
      const en = PUBLIC_RESERVATION_COPY.en.locationEntries;
      expect(en[LOCATION_SLUGS.STEAKHOUSE].description).toBe("El Poblado");
      expect(en[LOCATION_SLUGS.BAR_LOUNGE].description).toContain("2nd floor");
    });
  });
});
