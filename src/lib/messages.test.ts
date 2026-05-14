import { describe, expect, it } from "vitest";
import {
  ADMIN_ERROR_MESSAGES,
  PUBLIC_ERROR_MESSAGES,
  lookupMessage,
  lookupPublicMessage,
} from "@/lib/messages";

describe("public messages", () => {
  it("keeps Spanish and English public error message keys in parity", () => {
    expect(Object.keys(PUBLIC_ERROR_MESSAGES.en).sort()).toEqual(
      Object.keys(PUBLIC_ERROR_MESSAGES.es).sort(),
    );
  });

  it("resolves public opaque error keys by language", () => {
    expect(lookupPublicMessage(PUBLIC_ERROR_MESSAGES, "invalid-data", "es")).toBe(
      "Datos inválidos. Revisá el formulario.",
    );
    expect(lookupPublicMessage(PUBLIC_ERROR_MESSAGES, "invalid-data", "en")).toBe(
      "Invalid details. Please review the form.",
    );
  });

  it("falls back visually to English for unsupported public message languages", () => {
    expect(lookupPublicMessage(PUBLIC_ERROR_MESSAGES, "rate-limited", "foo")).toBe(
      "Too many requests from your connection. Please wait a moment before trying again.",
    );
  });

  it("keeps admin/internal message lookup Spanish-only", () => {
    expect(lookupMessage(ADMIN_ERROR_MESSAGES, "invalid-request")).toBe(
      "Solicitud inválida. Recargá la página e intentá nuevamente.",
    );
  });
});
