import { describe, expect, it } from "vitest";
import {
  DEFAULT_PUBLIC_LANGUAGE,
  parsePublicLanguage,
  publicLanguageSchema,
} from "@/lib/i18n/language";

describe("parsePublicLanguage (query/URL — fallback friendly)", () => {
  it("acepta los idiomas soportados", () => {
    expect(parsePublicLanguage("es")).toBe("es");
    expect(parsePublicLanguage("en")).toBe("en");
  });

  it("cae al default si el valor está ausente", () => {
    expect(parsePublicLanguage(undefined)).toBe(DEFAULT_PUBLIC_LANGUAGE);
    expect(parsePublicLanguage(null)).toBe(DEFAULT_PUBLIC_LANGUAGE);
  });

  it("cae al default si el valor no es un idioma soportado", () => {
    expect(parsePublicLanguage("fr")).toBe(DEFAULT_PUBLIC_LANGUAGE);
    expect(parsePublicLanguage("foo")).toBe(DEFAULT_PUBLIC_LANGUAGE);
    expect(parsePublicLanguage("")).toBe(DEFAULT_PUBLIC_LANGUAGE);
  });

  it("cae al default si el valor no es siquiera un string", () => {
    expect(parsePublicLanguage(123)).toBe(DEFAULT_PUBLIC_LANGUAGE);
    expect(parsePublicLanguage({ es: true })).toBe(DEFAULT_PUBLIC_LANGUAGE);
    expect(parsePublicLanguage(["es"])).toBe(DEFAULT_PUBLIC_LANGUAGE);
  });
});

describe("publicLanguageSchema (POST — strict)", () => {
  it("acepta los idiomas soportados", () => {
    expect(publicLanguageSchema.safeParse("es").success).toBe(true);
    expect(publicLanguageSchema.safeParse("en").success).toBe(true);
  });

  it("rechaza idiomas no soportados sin “autocorregir”", () => {
    // A diferencia del parser de query, acá NO queremos fallback silencioso:
    // si el cliente POSTea "foo" preferimos rechazar y devolver el error opaco.
    expect(publicLanguageSchema.safeParse("foo").success).toBe(false);
    expect(publicLanguageSchema.safeParse("fr").success).toBe(false);
    expect(publicLanguageSchema.safeParse("").success).toBe(false);
    expect(publicLanguageSchema.safeParse(undefined).success).toBe(false);
  });
});
