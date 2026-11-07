import { describe, expect, it } from "vitest";
import { normalizeReceipt, supportsVoice } from "./ai";

describe("lectura de tickets con cualquier IA", () => {
  it("acepta objeto o texto con JSON (incluso dentro de ```json)", () => {
    expect(normalizeReceipt({ total: 450.5, merchant: " Chedraui ", date: "2026-11-06", confidence: "high", readable: true })).toEqual({
      totalCents: 45_050,
      merchant: "Chedraui",
      date: "2026-11-06",
      confidence: "high",
    });
    expect(normalizeReceipt('```json\n{"total":"1,250.00","merchant":null,"date":"06/11/2026","readable":true}\n```')).toEqual({
      totalCents: 125_000,
      merchant: null,
      date: null,
      confidence: "low",
    });
  });

  it("rechaza tickets ilegibles o sin total", () => {
    expect(normalizeReceipt({ total: 0, readable: false })).toBeNull();
    expect(normalizeReceipt({ total: 120, readable: false })).toBeNull();
    expect(normalizeReceipt("no es un ticket")).toBeNull();
  });

  it("solo Gemini y OpenAI entienden voz", () => {
    expect(supportsVoice("gemini")).toBe(true);
    expect(supportsVoice("openai")).toBe(true);
    expect(supportsVoice("anthropic")).toBe(false);
  });
});
