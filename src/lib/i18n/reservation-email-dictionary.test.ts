import { describe, expect, it, vi } from "vitest";
import { PUBLIC_LANGUAGES, type PublicLanguage } from "@/lib/i18n/language";

// El diccionario es server-only; en vitest no hay runtime React server, así que
// neutralizamos el guard antes de importar el módulo.
vi.mock("server-only", () => ({}));

import {
  getReservationEmailCopy,
  RESERVATION_EMAIL_COPY,
  type ReservationEmailCopy,
} from "@/lib/i18n/reservation-email-dictionary";

// Recolecta un set de keys jerárquico (e.g. "labels.areaTbd", "confirmation.subject")
// para comparar shape entre idiomas sin depender del orden de declaración.
function collectKeyShape(value: unknown, prefix = ""): Set<string> {
  const keys = new Set<string>();
  if (value === null || typeof value !== "object") return keys;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    keys.add(fullKey);
    if (child !== null && typeof child === "object") {
      for (const nested of collectKeyShape(child, fullKey)) keys.add(nested);
    }
  }
  return keys;
}

const REQUIRED_KIND_KEYS = ["subject", "title", "introHtml", "footerHtml"] as const;
const REQUIRED_LABEL_KEYS = ["date", "time", "area", "areaTbd", "confirmedBy", "reason"] as const;

describe("RESERVATION_EMAIL_COPY", () => {
  it("provides a complete ReservationEmailCopy entry for every PublicLanguage", () => {
    for (const language of PUBLIC_LANGUAGES) {
      const copy = RESERVATION_EMAIL_COPY[language];
      expect(copy, `missing copy for language ${language}`).toBeDefined();

      // Top-level scalar fields
      expect(typeof copy.dateLocale).toBe("string");
      expect(copy.greeting).toBeTruthy();
      expect(typeof copy.timeSuffix).toBe("string");
      expect(copy.rightsReserved).toBeTruthy();

      // Labels
      for (const labelKey of REQUIRED_LABEL_KEYS) {
        expect(
          copy.labels[labelKey],
          `labels.${labelKey} missing/empty for language ${language}`,
        ).toBeTruthy();
      }

      // Per-kind copy (confirmation/rejection/cancellation)
      for (const kind of ["confirmation", "rejection", "cancellation"] as const) {
        const kindCopy = copy[kind];
        for (const k of REQUIRED_KIND_KEYS) {
          expect(
            kindCopy[k],
            `${kind}.${k} missing/empty for language ${language}`,
          ).toBeTruthy();
        }
      }
    }
  });

  it("preserves the legacy Spanish strings byte-identically (back-compat contract)", () => {
    const es: ReservationEmailCopy = RESERVATION_EMAIL_COPY.es;

    // Subjects (back-compat: estos eran los strings hardcoded antes de esta mejora)
    expect(es.confirmation.subject).toBe("Tu reserva en TAURAS ha sido confirmada");
    expect(es.rejection.subject).toBe("Tu solicitud de reserva en TAURAS");
    expect(es.cancellation.subject).toBe("Tu reserva en TAURAS ha sido cancelada");

    // <strong> markup en intros
    expect(es.confirmation.introHtml).toContain("<strong>confirmada exitosamente</strong>");
    expect(es.rejection.introHtml).toContain("<strong>no pudo ser confirmada</strong>");
    expect(es.cancellation.introHtml).toContain("<strong>cancelada</strong>");

    // Labels y tokens estables
    expect(es.labels.areaTbd).toBe("A designar");
    expect(es.dateLocale).toBe("es-CO");
    expect(es.timeSuffix).toBe(" h");
    expect(es.greeting).toBe("Hola");
  });

  it("provides English copy with non-empty values, <strong> markup preserved, and locale tokens", () => {
    const en: ReservationEmailCopy = RESERVATION_EMAIL_COPY.en;

    // Tokens estables EN
    expect(en.dateLocale).toBe("en-US");
    expect(en.greeting).toBe("Hello");
    expect(en.labels.areaTbd).toBe("To be assigned");

    // <strong> markup presente en mismas posiciones lógicas
    for (const kind of ["confirmation", "rejection", "cancellation"] as const) {
      const intro = en[kind].introHtml;
      expect(intro, `${kind}.introHtml should contain <strong>`).toContain("<strong>");
      expect(intro, `${kind}.introHtml should contain </strong>`).toContain("</strong>");
    }
  });

  it("has identical key shape across all PublicLanguages (no missing or extra nested keys)", () => {
    const shapes = PUBLIC_LANGUAGES.map((lang: PublicLanguage) => ({
      lang,
      keys: collectKeyShape(RESERVATION_EMAIL_COPY[lang]),
    }));

    const reference = shapes[0];
    expect(reference, "expected at least one PublicLanguage").toBeDefined();

    for (const { lang, keys } of shapes.slice(1)) {
      const referenceKeys = reference!.keys;
      const missing = [...referenceKeys].filter((k) => !keys.has(k));
      const extra = [...keys].filter((k) => !referenceKeys.has(k));
      expect(missing, `${lang} is missing keys: ${missing.join(", ")}`).toEqual([]);
      expect(extra, `${lang} has extra keys: ${extra.join(", ")}`).toEqual([]);
    }
  });

  it("getReservationEmailCopy returns the matching dictionary entry", () => {
    expect(getReservationEmailCopy("es")).toBe(RESERVATION_EMAIL_COPY.es);
    expect(getReservationEmailCopy("en")).toBe(RESERVATION_EMAIL_COPY.en);
  });
});
