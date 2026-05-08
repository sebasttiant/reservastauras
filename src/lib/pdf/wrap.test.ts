import { describe, expect, it } from "vitest";
import { splitTextByLength, wrapText } from "@/lib/pdf/wrap";

describe("splitTextByLength", () => {
  it("returns the input untouched when shorter than maxLength", () => {
    expect(splitTextByLength("Hola Mundo", 40)).toEqual(["Hola Mundo"]);
  });

  it("wraps on word boundaries", () => {
    const lines = splitTextByLength("uno dos tres cuatro cinco", 10);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(10);
    }
    expect(lines.join(" ")).toBe("uno dos tres cuatro cinco");
  });

  it("hard-breaks a single word longer than maxLength so it never overflows", () => {
    const longWord = "a".repeat(50);
    const lines = splitTextByLength(longWord, 10);
    expect(lines.length).toBe(5);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(10);
    }
    expect(lines.join("")).toBe(longWord);
  });

  it("hard-breaks a long word inside a paragraph and keeps the rest wrapped on word boundaries", () => {
    const text = `inicio ${"x".repeat(35)} final`;
    const lines = splitTextByLength(text, 10);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(10);
    }
    expect(lines.join("").replaceAll(" ", "")).toBe(text.replaceAll(" ", ""));
  });

  it("hard-breaks an email-like token without spaces", () => {
    const token = "cliente.muy.largo+filtro@dominio-extendido-corporativo.com";
    const lines = splitTextByLength(token, 20);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(20);
    }
    expect(lines.join("")).toBe(token);
  });
});

describe("wrapText", () => {
  it("respects explicit \\n before applying length wrapping", () => {
    const input = "Motivo: cumpleaños\nPaís: Argentina\nEspecificaciones: -";
    const lines = wrapText(input, 80);
    expect(lines).toEqual([
      "Motivo: cumpleaños",
      "País: Argentina",
      "Especificaciones: -",
    ]);
  });

  it("hard-breaks long unbroken text inside a multi-line input", () => {
    const longUrl = "https://" + "a".repeat(60) + ".example.com";
    const input = `Motivo: link\n${longUrl}\nPaís: AR`;
    const lines = wrapText(input, 20);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(20);
    }
    expect(lines.some((l) => l.startsWith("Motivo:"))).toBe(true);
    expect(lines[lines.length - 1]).toBe("País: AR");
  });
});
