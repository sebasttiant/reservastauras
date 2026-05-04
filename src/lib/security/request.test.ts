import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getRequestSecurityContext, isValidAdminMutationOrigin } = await import("@/lib/security/request");

describe("isValidAdminMutationOrigin", () => {
  it("rechaza acciones mutantes sin Origin", () => {
    expect(isValidAdminMutationOrigin(new Headers({ host: "tauras.example" }))).toBe(false);
  });

  it("permite Origin que coincide con Host", () => {
    const headers = new Headers({ origin: "https://tauras.example", host: "tauras.example" });

    expect(isValidAdminMutationOrigin(headers)).toBe(true);
  });

  it("permite Origin que coincide con X-Forwarded-Host", () => {
    const headers = new Headers({
      origin: "https://reservas.tauras.example",
      host: "internal:3000",
      "x-forwarded-host": "reservas.tauras.example",
    });

    expect(isValidAdminMutationOrigin(headers)).toBe(true);
  });

  it("rechaza Origin de otro host", () => {
    const headers = new Headers({ origin: "https://evil.example", host: "tauras.example" });

    expect(isValidAdminMutationOrigin(headers)).toBe(false);
  });

  it("rechaza Origin con protocolo distinto al X-Forwarded-Proto", () => {
    const headers = new Headers({
      origin: "http://tauras.example",
      host: "tauras.example",
      "x-forwarded-proto": "https",
    });

    expect(isValidAdminMutationOrigin(headers)).toBe(false);
  });
});

describe("getRequestSecurityContext", () => {
  it("prioriza Cloudflare IP y conserva User-Agent", () => {
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.20, 198.51.100.21",
      "user-agent": "Vitest",
    });

    expect(getRequestSecurityContext(headers)).toEqual({ ipAddress: "203.0.113.10", userAgent: "Vitest" });
  });

  it("usa la primera IP de X-Forwarded-For cuando no hay CF-Connecting-IP", () => {
    const headers = new Headers({ "x-forwarded-for": "198.51.100.20, 198.51.100.21" });

    expect(getRequestSecurityContext(headers)).toEqual({ ipAddress: "198.51.100.20", userAgent: null });
  });
});
