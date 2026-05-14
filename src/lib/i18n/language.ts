import { z } from "zod";

// Idiomas soportados por la superficie pública (formulario + emails al cliente).
// El admin sigue siendo siempre español/internal: NO se agrega acá.
export const PUBLIC_LANGUAGES = ["es", "en"] as const;

export const DEFAULT_PUBLIC_LANGUAGE = "en" as const;

export type PublicLanguage = (typeof PUBLIC_LANGUAGES)[number];

// Parser para el `?lang=` que viene en la URL pública. La URL es un canal
// controlado por el cliente: cualquier valor desconocido (incluyendo strings
// vacíos, no-strings o idiomas como "fr") cae a `en` para que el render y
// los redirects nunca propaguen valores no soportados.
export function parsePublicLanguage(value: unknown): PublicLanguage {
  if (typeof value !== "string") return DEFAULT_PUBLIC_LANGUAGE;
  return (PUBLIC_LANGUAGES as readonly string[]).includes(value)
    ? (value as PublicLanguage)
    : DEFAULT_PUBLIC_LANGUAGE;
}

// Schema estricto para el campo `customerLanguage` POSTeado por el formulario.
// A diferencia del parser de query, valores no soportados deben FALLAR la
// validación: si el cliente manda "foo", no queremos persistirlo ni "corregirlo"
// silenciosamente — preferimos rechazar y devolver el error opaco habitual.
export const publicLanguageSchema = z.enum(PUBLIC_LANGUAGES);
